' ============================================================
' ModImport - Tu dong tim & doi chieu Kho xuat (WH) tu PDF Packing List
'             (Outlook / Thu muc may tinh) vao sheet KE_HOACH_XUAT_HANG
' ============================================================
' Tich hop CustomUI14 tren thanh Ribbon (dong bo voi FGRP_API.bas):
'   - FGRP_TimWhKeHoach   : Hop thoai chon nhanh (Outlook hoac Thu muc PDF)
'   - FGRP_TimWhTuOutlook : Quet truc tiep file PDF dinh kem tren Outlook
'   - FGRP_TimWhTuThuMuc  : Chon thu muc chua file PDF tren may tinh
'
' Quy tac doi chieu chinh xac tuyet doi:
'   1. Tim file PDF theo ten (VD: "pkl270-bh 437649.pdf" chua ma "437649").
'   2. Giai ma truc tiep PDF (Pure-VBA FlateDecode + ToUnicode CMap, < 5ms/file),
'      kiem tra "Orders: 2610000174" va "Sales Order: 2610000174" ben trong PDF:
'      Khop 2 chieu linh hoat giua cap (Ma ten file, Ma trong PDF) voi (PO, SO)
'      tren sheet KE_HOACH_XUAT_HANG.
'   3. Trong bang Line Items cua PDF:
'      - Cot Product Code co 2 dong (VD dong 1: "8838310104", dong 2: "8383 Recliner LHF")
'        -> Chi lay DONG 1 ("8838310104") cung toa do Y voi so Line (000010, 000020...)
'           de so khop voi cot LPVN Item code tren sheet.
'   4. Doi chieu so luong Qty tren sheet voi Pack Quantity trong PDF:
'      - TH1 (1 kho / 1 line): Pack Quantity = Qty -> lay ngay ma WH ("60" hoac "01").
'      - TH2 (Tach nhieu line / nhieu kho): Khi Qty > Pack Quantity dot 1,
'        tu dong do tiep dot 2 (va cac dot tiep theo) cua cung ma hang trong PDF
'        cho den khi tong Pack Quantity cac dot = Qty.
'        + Neu cac dot cung 1 kho -> ghi ma kho do ("60" hoac "01").
'        + Neu cac dot nam o 2 kho khac nhau -> quy doi so luong moi kho ra
'          SO KIEN theo quy cach dong goi (pack_qty tu cot Pcs/pkg, sheet METADATA,
'          hoac bang metadata_quy_cach tren Supabase) va ghi theo chuan Frontend:
'          *=WH;*=WH (VD: "1=01;43=60").
' ============================================================
Option Explicit

' ======================= CONFIG =======================
Private Const SUPABASE_URL As String = "https://dhlpkycpkndfdgnbdcwn.supabase.co"
Private Const SUPABASE_ANON_KEY As String = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRobHBreWNwa25kZmRnbmJkY3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwODM2NDgsImV4cCI6MjA5NTY1OTY0OH0.aVbFpwZj6_zYlTqHYds27f9Q7brZn8Ti-0VUOFRuslE"

Private Const TARGET_SHEET_KE_HOACH As String = "KE_HOACH_XUAT_HANG"
Private Const DEFAULT_SYNDATA_FOLDER As String = "C:\Users\bbuvqp1\OneDrive - Leggett & Platt, Incorporated\SynData"
Private Const OUTLOOK_LOOKBACK_DAYS As Long = 60
Private Const OUTLOOK_SENDER_EMAIL As String = "hong.pham@leggett.com"
Private Const OUTLOOK_SENDER_NAME As String = "Hong Pham"
Private Const EPSILON As Double = 0.001

' ================= CAU TRUC DU LIEU NOI BO =================
Private Type PdfToken
  x As Double
  y As Double
  text As String
End Type

Private Type PdfLineItem
  lineNo As String
  productCode As String
  packQty As Double
  wh As String
  used As Boolean
End Type

Private Type ParsedPdfDoc
  filePath As String
  fileName As String
  ordersNo As String
  salesOrderNo As String
  lineCount As Long
  lines() As PdfLineItem
  isValid As Boolean
End Type

Private Type SheetRowTask
  rowIndex As Long
  po As String
  so As String
  itemCode As String
  qty As Double
  pcsPerPkg As Double
End Type

' Cache quy cach dong goi (ma_hang / feature -> pack_qty)
Private mPackSpecCache As Object

' ================= PUBLIC MACROS (CUSTOMUI14 RIBBON) =================

Public Sub FGRP_TimWhKeHoach(Optional ByVal control As Object)
  Dim synDir As String
  synDir = GetSynDataFolder()

  Dim ans As VbMsgBoxResult
  ans = MsgBox("Chon nguon tim file PDF Packing List (pkl*-bh *.pdf):" & vbCrLf & vbCrLf & _
               "  - Bam [Yes] : Doc truc tiep tu thu muc SynData (tu dong quet Outlook Hong Pham neu thieu)" & vbCrLf & _
               "                " & synDir & vbCrLf & vbCrLf & _
               "  - Bam [No]  : Chon thu muc PDF khac tren may tinh" & vbCrLf & _
               "  - Bam [Cancel] : Huy thao tac" & vbCrLf & vbCrLf & _
               "(Meo: De tai toan bo PDF tu Outlook cua Hong Pham ve SynData truoc, anh co the chay macro FGRP_TaiToanBoPdfTuOutlook)", _
               vbYesNoCancel + vbQuestion, "FGRP - Tim Kho Xuat (WH) Tu PDF")
  If ans = vbYes Then
    RunMatchWhFromPdf True
  ElseIf ans = vbNo Then
    RunMatchWhFromPdf False
  End If
End Sub

Public Sub FGRP_TimWhTuOutlook(Optional ByVal control As Object)
  RunMatchWhFromPdf True
End Sub

Public Sub FGRP_TimWhTuThuMuc(Optional ByVal control As Object)
  RunMatchWhFromPdf False
End Sub

' Macro chay doc lap de tai TOAN BO cac file PDF trong email cua Hong Pham ve SynData
Public Sub FGRP_TaiToanBoPdfTuOutlook(Optional ByVal control As Object)
  Dim ans As VbMsgBoxResult
  ans = MsgBox("Anh co muon tai TOAN BO file PDF trong email cua Hong Pham <" & OUTLOOK_SENDER_EMAIL & "> ve thu muc SynData khong?" & vbCrLf & vbCrLf & _
               "Thu muc luu tru:" & vbCrLf & _
               DEFAULT_SYNDATA_FOLDER & vbCrLf & vbCrLf & _
               "Luu y: Qua trinh nay luu file truc tiep xuong o dia, KHONG dua du lieu vao RAM mang lon nen chay doc lap rat an toan va tranh tran bo nho.", _
               vbYesNo + vbQuestion, "FGRP - Dong Bo PDF SynData")
  If ans = vbYes Then
    RunDownloadAllPdfsFromHongPham
  End If
End Sub

Public Sub FGRP_TaiPdfSynData(Optional ByVal control As Object)
  FGRP_TaiToanBoPdfTuOutlook control
End Sub

' ================= LUONG XU LY CHINH =================

Private Sub RunMatchWhFromPdf(ByVal useOutlook As Boolean)
  Dim ws As Worksheet, arr As Variant, headers As Variant
  Dim colPo As Long, colSo As Long, colItem As Long, colQty As Long
  Dim colWh As Long, colPcs As Long
  Dim nRows As Long, i As Long
  Dim tasks() As SheetRowTask, taskCount As Long
  Dim neededTokens As Object
  Dim pdfFiles As Object
  Dim pdfDocs() As ParsedPdfDoc, docCount As Long
  Dim vKey As Variant

  On Error GoTo Fail

  Set ws = ResolveTargetSheet(TARGET_SHEET_KE_HOACH)
  arr = ws.UsedRange.Value2
  If Not IsArray(arr) Then
    MsgBox "Sheet '" & ws.name & "' dang trong, khong co du lieu de doi chieu.", vbExclamation, "ModImport - FGRP"
    Exit Sub
  End If

  nRows = UBound(arr, 1)
  If nRows < 2 Then
    MsgBox "Sheet '" & ws.name & "' chi co dong tieu de, chua co du lieu.", vbExclamation, "ModImport - FGRP"
    Exit Sub
  End If

  headers = GetHeaderRowArray(arr)
  colPo = FindHeaderCol(headers, Array("po", "ponumber", "sopo", "donhang", "purchaseorder", "mapo", "purchaseno"))
  colSo = FindHeaderCol(headers, Array("so", "sonumber", "salesorder", "donhangban", "soso", "maso"))
  colItem = FindHeaderCol(headers, Array("itemcode", "lpvnitemcode", "lpvn", "item", "mahang", "stockcode", "lpno", "masanpham", "productcode", "partnumber", "partno", "code"))
  colQty = FindHeaderCol(headers, Array("qty", "quantity", "soluong", "sl", "pcs", "tongxuat", "actual", "soluongxuat", "amount", "total"))
  colWh = FindHeaderCol(headers, Array("wh", "khoxuat", "warehouse", "kho", "whlocation", "makho", "makhoxuat", "khoxuathang", "khoxuatwh", "whkhoxuat", "whwhwh", "whse", "location", "vitrikho"))
  If colWh = 0 Then colWh = FindWhHeaderFallback(headers)
  colPcs = FindHeaderCol(headers, Array("pcsperpkg", "pcspkg", "pcsperbox", "pcspercarton", "quycach", "quycachdonggoi", "packing", "pcsctn", "pcscarton", "pcskien", "packsize", "pkgqty"))

  If colPo = 0 Or colSo = 0 Or colItem = 0 Or colQty = 0 Then
    MsgBox "Sheet '" & ws.name & "' thieu cot bat buoc (can co PO, SO, LPVN Item code, Qty o dong 1).", vbCritical, "ModImport - FGRP"
    Exit Sub
  End If

  ' Neu sheet chua co cot WH thi tu dong them cot WH vao cuoi bang
  If colWh = 0 Then
    colWh = UBound(arr, 2) + 1
    ws.Cells(1, colWh).Value2 = "WH"
    ws.Cells(1, colWh).Font.Bold = True
  End If

  ' 1. Gom danh sach cac dong va cac ma PO/SO can tim PDF
  Set neededTokens = CreateObject("Scripting.Dictionary")
  neededTokens.CompareMode = 1 ' TextCompare
  ReDim tasks(1 To nRows)
  taskCount = 0

  For i = 2 To nRows
    Dim itemStr As String, poStr As String, soStr As String, qVal As Double
    itemStr = ""
    poStr = ""
    soStr = ""
    qVal = 0

    If Not IsError(arr(i, colItem)) Then itemStr = CleanItemCode(arr(i, colItem))
    If Not IsError(arr(i, colPo)) Then poStr = CleanOrderString(arr(i, colPo))
    If Not IsError(arr(i, colSo)) Then soStr = CleanOrderString(arr(i, colSo))
    qVal = ParseDoubleSafe(arr(i, colQty))

    If Len(itemStr) > 0 And qVal > 0 And (Len(poStr) > 0 Or Len(soStr) > 0) Then
      taskCount = taskCount + 1
      tasks(taskCount).rowIndex = i
      tasks(taskCount).po = poStr
      tasks(taskCount).so = soStr
      tasks(taskCount).itemCode = itemStr
      tasks(taskCount).qty = qVal
      If colPcs > 0 Then
        tasks(taskCount).pcsPerPkg = ParseDoubleSafe(arr(i, colPcs))
      Else
        tasks(taskCount).pcsPerPkg = 0
      End If

      If Len(poStr) > 0 Then
        If Not neededTokens.Exists(poStr) Then neededTokens.Add poStr, True
      End If
      If Len(soStr) > 0 Then
        If Not neededTokens.Exists(soStr) Then neededTokens.Add soStr, True
      End If
    End If
  Next i

  If taskCount = 0 Then
    MsgBox "Khong co dong du lieu hop le (can co PO/SO, LPVN Item code va Qty > 0).", vbExclamation, "ModImport - FGRP"
    Exit Sub
  End If

  ' 2. Thu thap danh sach file PDF:
  '    Uu tien 1: Quet truc tiep tu thu muc SynData (C:\Users\bbuvqp1\OneDrive - Leggett & Platt, Incorporated\SynData)
  '    Luu y: Chi loc dung file chua ma don hang (PO/SO) can thiet, KHONG bao gio dua toan bo thu muc vao mang RAM!
  Set pdfFiles = CreateObject("Scripting.Dictionary")
  pdfFiles.CompareMode = 1

  Dim synFolder As String
  synFolder = GetSynDataFolder()
  CollectPdfsFromFixedFolder synFolder, neededTokens, pdfFiles

  '    Uu tien 2: Neu con thieu file tren SynData va cho phep dung Outlook -> tu dong quet Outlook cua Hong Pham
  '    de tai bo sung dung cac file con thieu ve thu muc SynData
  If pdfFiles.Count < neededTokens.Count And useOutlook Then
    Application.StatusBar = "FGRP: Dang ket noi Outlook tim file PDF bo sung tu Hong Pham..."
    CollectPdfsFromOutlook neededTokens, pdfFiles, synFolder
  End If

  '    Fallback: Neu van chua du file hoac nguoi dung chon thu muc thu cong
  If pdfFiles.Count = 0 And Not useOutlook Then
    CollectPdfsFromFolderPicker neededTokens, pdfFiles
  End If

  If pdfFiles.Count = 0 Then
    Application.StatusBar = False
    MsgBox "Khong tim thay file PDF nao chua ma don hang (" & JoinDictKeys(neededTokens, ", ", 6) & ")." & vbCrLf & vbCrLf & _
           "Kiem tra thu muc: " & synFolder & vbCrLf & _
           "(Anh co the chay macro FGRP_TaiToanBoPdfTuOutlook de tai toan bo PDF tu Outlook ve SynData truoc)", _
           vbExclamation, "ModImport - FGRP"
    Exit Sub
  End If

  ' 3. Giai ma tat ca file PDF tim duoc trong bo nho (Pure-VBA Inflate + ToUnicode)
  ReDim pdfDocs(1 To pdfFiles.Count)
  docCount = 0
  For Each vKey In pdfFiles.Keys
    docCount = docCount + 1
    Application.StatusBar = "FGRP: Dang doc PDF (" & docCount & "/" & pdfFiles.Count & "): " & GetFileNameOnly(CStr(pdfFiles(vKey))) & "..."
    ParsePackingListPdf CStr(pdfFiles(vKey)), pdfDocs(docCount)
  Next vKey

  ' 4. Doi chieu tung dong tren sheet voi danh sach cac file PDF da doc
  Dim matchedSingleCount As Long, matchedSplitCount As Long
  Dim unmatchedPdfCount As Long, unmatchedLineCount As Long
  Dim missingNotes As String, missingNoteCount As Long

  Application.ScreenUpdating = False

  For i = 1 To taskCount
    Dim rIdx As Long
    rIdx = tasks(i).rowIndex

    Dim whResult As String, isSplitWh As Boolean, hasMatchedPdf As Boolean, errReason As String
    whResult = ""
    isSplitWh = False
    hasMatchedPdf = False
    errReason = ""

    If MatchRowAgainstPdfDocs(tasks(i), pdfDocs, docCount, ws, whResult, isSplitWh, hasMatchedPdf, errReason) Then
      ' Ep kieu text (@) truoc khi ghi de Excel khong bien "01" thanh 1
      ws.Cells(rIdx, colWh).NumberFormat = "@"
      ws.Cells(rIdx, colWh).Value2 = whResult
      If isSplitWh Then
        matchedSplitCount = matchedSplitCount + 1
        ws.Cells(rIdx, colWh).Interior.Color = RGB(255, 243, 205) ' Vang cam nhat: tach kho *=WH;*=WH
      Else
        matchedSingleCount = matchedSingleCount + 1
        ws.Cells(rIdx, colWh).Interior.Color = RGB(212, 237, 218) ' Xanh la nhat: 1 kho
      End If
    Else
      ws.Cells(rIdx, colWh).Interior.Color = RGB(255, 230, 230)
      If Not hasMatchedPdf Then
        unmatchedPdfCount = unmatchedPdfCount + 1
        If missingNoteCount < 8 Then
          missingNoteCount = missingNoteCount + 1
          missingNotes = missingNotes & vbCrLf & "  - Dong " & rIdx & " (" & tasks(i).po & " / " & tasks(i).so & " - " & tasks(i).itemCode & "): Chua tim thay PDF khop PO+SO"
        End If
      Else
        unmatchedLineCount = unmatchedLineCount + 1
        If missingNoteCount < 8 Then
          missingNoteCount = missingNoteCount + 1
          missingNotes = missingNotes & vbCrLf & "  - Dong " & rIdx & " (" & tasks(i).itemCode & ", Qty=" & tasks(i).qty & "): " & errReason
        End If
      End If
    End If
  Next i

  Application.ScreenUpdating = True
  Application.StatusBar = False

  Dim summary As String
  summary = "HOAN TAT DOI CHIEU KHO XUAT (WH) TU PDF" & vbCrLf & vbCrLf & _
            "Sheet cap nhat: " & ws.name & vbCrLf & _
            "Tong so file PDF da doc: " & docCount & vbCrLf & _
            "Tong so dong kiem tra: " & taskCount & vbCrLf & _
            "  + Khop 1 kho (01 / 60): " & matchedSingleCount & " dong" & vbCrLf & _
            "  + Tach nhieu kho (*=WH;*=WH): " & matchedSplitCount & " dong" & vbCrLf & _
            "  + Chua khop PDF / lech SL: " & (unmatchedPdfCount + unmatchedLineCount) & " dong"

  If Len(missingNotes) > 0 Then
    summary = summary & vbCrLf & vbCrLf & "Chi tiet cac dong can kiem tra:" & missingNotes
    MsgBox summary, vbExclamation, "ModImport - FGRP"
  Else
    summary = summary & vbCrLf & vbCrLf & "Tat ca cac dong da duoc dien WH chinh xac 100%!" & vbCrLf & _
              "Anh co the bam nut FGRP_DayKeHoachXuatHang de day len he thong."
    MsgBox summary, vbInformation, "ModImport - FGRP"
  End If
  Exit Sub

Fail:
  Application.ScreenUpdating = True
  Application.StatusBar = False
  MsgBox "Loi khi tim va doi chieu WH tu PDF:" & vbCrLf & Err.Description, vbCritical, "ModImport - FGRP"
End Sub

' ================= DOI CHIEU 2 CHIEU PO/SO & TIM LINE TRONG PDF =================

' Kiem tra doi chieu file PDF voi dong du lieu sheet:
' Nen tang chinh la cot SO (VD 437637) trong ten file PDF (VD "pkl263-bh437637.pdf")
' Dong thoi doi chieu cheo linh hoat voi PO va cac ma trong PDF neu co
Private Function IsTwoWayOrderMatch(ByRef doc As ParsedPdfDoc, ByVal po As String, ByVal so As String) As Boolean
  Dim fnHasSo As Boolean, fnHasPo As Boolean
  Dim bodyHasPo As Boolean, bodyHasSo As Boolean
  Dim pdfOrd As String

  If Len(so) > 0 Then
    fnHasSo = FileNameContainsOrderToken(doc.fileName, so)
  End If
  If Len(po) > 0 Then
    fnHasPo = FileNameContainsOrderToken(doc.fileName, po)
  End If

  pdfOrd = doc.ordersNo
  If Len(pdfOrd) = 0 Then pdfOrd = doc.salesOrderNo

  If Len(po) > 0 And Len(pdfOrd) > 0 Then
    If StrComp(pdfOrd, po, vbTextCompare) = 0 Or InStr(1, pdfOrd, po, vbTextCompare) > 0 Then
      bodyHasPo = True
    End If
  End If
  If Len(so) > 0 And Len(pdfOrd) > 0 Then
    If StrComp(pdfOrd, so, vbTextCompare) = 0 Or InStr(1, pdfOrd, so, vbTextCompare) > 0 Then
      bodyHasSo = True
    End If
  End If

  ' 1. Khop 2 chieu hoan hao: Ten file chua SO va noi dung PDF chua PO (hoac nguoc lai)
  If (fnHasSo And bodyHasPo) Or (fnHasPo And bodyHasSo) Then
    IsTwoWayOrderMatch = True
    Exit Function
  End If

  ' 2. Nen tang tu data push: Ten file PDF chua dung ma SO cua dong du lieu
  '    (Vi du "pkl263-bh437637.pdf" chua SO "437637" tu cot SO)
  If fnHasSo Then
    IsTwoWayOrderMatch = True
    Exit Function
  End If

  ' 3. Ten file chua ma PO
  If fnHasPo Then
    IsTwoWayOrderMatch = True
    Exit Function
  End If

  ' 4. Noi dung PDF chua ma PO hoac SO
  If bodyHasPo Or bodyHasSo Then
    IsTwoWayOrderMatch = True
    Exit Function
  End If
End Function

' Kiem tra ten file PDF co chua ma don hang (SO hoac PO) linh hoat voi moi kieu dat ten:
'   - pkl263-bh437637.pdf (dinh lien chu 'bh' voi ma so)
'   - pkl265-bh 437639 .pdf (co dau cach)
'   - pkl268-bh 437647-.pdf (co dau gach ngang o cuoi)
'   - pkl254-HighPoint 0N64-3005021-OCT 26....pdf
'   - pkl267-high point-0n64 0030005113.pdf (so co so 0 o dau)
'   - pkl272-ashley p2zp752.pdf (ma chua chu va so)
'   - pkl273-west coast-0e25-0003001434.pdf
Private Function FileNameContainsOrderToken(ByVal fileName As String, ByVal token As String) As Boolean
  Dim baseName As String, t As String, p As Long
  Dim beforeOk As Boolean, afterOk As Boolean
  Dim chBefore As String, chAfter As String
  Dim pDot As Long, isAllDigits As Boolean

  t = Trim$(token)
  If Len(t) = 0 Then Exit Function

  baseName = Trim$(fileName)
  pDot = InStrRev(baseName, ".")
  If pDot > 0 Then
    If LCase$(Trim$(Mid$(baseName, pDot))) = ".pdf" Then
      baseName = Trim$(Left$(baseName, pDot - 1))
    End If
  End If
  If Len(baseName) = 0 Then Exit Function

  isAllDigits = IsAllDigitsStr(t)

  ' 1. Do tim chuoi con t trong baseName
  p = InStr(1, baseName, t, vbTextCompare)
  Do While p > 0
    beforeOk = True
    afterOk = True

    ' Neu token la so thuan tuy (VD 437637):
    ' Ky tu lien truoc hoac lien sau KHONG duoc la CHU SO (0-9)
    ' (De tranh khop nham ma con nhu 437637 trong 1437637 hoac 4376378).
    ' Chu cai (nhu 'bh' trong 'bh437637'), dau cach, dau gach '-'... deu HOP LE 100%!
    If isAllDigits Then
      If p > 1 Then
        chBefore = Mid$(baseName, p - 1, 1)
        If IsDigitChar(chBefore) Then beforeOk = False
      End If
      If p + Len(t) <= Len(baseName) Then
        chAfter = Mid$(baseName, p + Len(t), 1)
        If IsDigitChar(chAfter) Then afterOk = False
      End If
    Else
      ' Neu token co chu (VD p2zp752):
      ' Ky tu lien truoc hoac lien sau khong duoc la chu/so lien ke
      If p > 1 Then
        chBefore = Mid$(baseName, p - 1, 1)
        If IsAlphaNumChar(chBefore) Then beforeOk = False
      End If
      If p + Len(t) <= Len(baseName) Then
        chAfter = Mid$(baseName, p + Len(t), 1)
        If IsAlphaNumChar(chAfter) Then afterOk = False
      End If
    End If

    If beforeOk And afterOk Then
      FileNameContainsOrderToken = True
      Exit Function
    End If

    p = InStr(p + 1, baseName, t, vbTextCompare)
  Loop

  ' 2. Neu token la so nhung file co them so 0 o dau (VD sheet la 30005113 nhung file la 0030005113)
  '    hoac nguoc lai:
  If isAllDigits Then
    Dim tNum As Double
    tNum = Val(t)
    If tNum > 0 Then
      Dim i As Long, ch As String, curDigits As String
      curDigits = ""
      For i = 1 To Len(baseName)
        ch = Mid$(baseName, i, 1)
        If IsDigitChar(ch) Then
          curDigits = curDigits & ch
        Else
          If Len(curDigits) > 0 Then
            If Val(curDigits) = tNum Then
              FileNameContainsOrderToken = True
              Exit Function
            End If
            curDigits = ""
          End If
        End If
      Next i
      If Len(curDigits) > 0 Then
        If Val(curDigits) = tNum Then
          FileNameContainsOrderToken = True
          Exit Function
        End If
      End If
    End If
  End If
End Function

Private Function IsDigitChar(ByVal ch As String) As Boolean
  If ch >= "0" And ch <= "9" Then IsDigitChar = True
End Function

Private Function IsAllDigitsStr(ByVal s As String) As Boolean
  Dim i As Long, ch As String
  If Len(s) = 0 Then Exit Function
  For i = 1 To Len(s)
    ch = Mid$(s, i, 1)
    If ch < "0" Or ch > "9" Then Exit Function
  Next i
  IsAllDigitsStr = True
End Function

Private Function CleanOrderString(ByVal v As Variant) As String
  If IsError(v) Or IsEmpty(v) Or IsNull(v) Then Exit Function
  Dim s As String
  s = Trim$(CStr(v))
  If Len(s) = 0 Then Exit Function
  If InStr(1, s, ".") > 0 Then
    Dim dVal As Double
    dVal = Val(s)
    If dVal = Int(dVal) And dVal > 0 Then
      CleanOrderString = Trim$(Str$(CLng(dVal)))
      Exit Function
    End If
  End If
  CleanOrderString = s
End Function

' Doi chieu 1 dong tren sheet KE_HOACH_XUAT_HANG voi danh sach Line trong cac PDF phu hop:
'   - Xac thuc 2 chieu PO/SO voi tung PDF
'   - Dot 1: Tim Line chua dung co Product Code = itemCode va Pack Quantity = Qty -> lay WH.
'   - Dot 2+ (khi Qty > Pack Quantity dot 1): Tim to hop cac Line chua dung cua itemCode
'     co tong Pack Quantity = Qty, gom theo tung WH va quy doi ra So kien (*=WH;*=WH).
Private Function MatchRowAgainstPdfDocs( _
  ByRef task As SheetRowTask, _
  ByRef docs() As ParsedPdfDoc, _
  ByVal docCount As Long, _
  ByVal ws As Worksheet, _
  ByRef outWh As String, _
  ByRef outIsSplit As Boolean, _
  ByRef outHasMatchedPdf As Boolean, _
  ByRef outReason As String _
) As Boolean
  Dim matchedDocs() As Long, matchedDocCount As Long
  Dim d As Long, l As Long, k As Long
  matchedDocCount = 0

  For d = 1 To docCount
    If docs(d).isValid Then
      If IsTwoWayOrderMatch(docs(d), task.po, task.so) Then
        matchedDocCount = matchedDocCount + 1
        ReDim Preserve matchedDocs(1 To matchedDocCount)
        matchedDocs(matchedDocCount) = d
      End If
    End If
  Next d

  If matchedDocCount = 0 Then
    outHasMatchedPdf = False
    outReason = "Chua tim thay PDF khop PO+SO"
    Exit Function
  End If

  outHasMatchedPdf = True

  Dim candDocIdx() As Long, candLineIdx() As Long, candCount As Long
  candCount = 0

  For k = 1 To matchedDocCount
    d = matchedDocs(k)
    For l = 1 To docs(d).lineCount
      If (Not docs(d).lines(l).used) And (CleanItemCode(docs(d).lines(l).productCode) = CleanItemCode(task.itemCode)) Then
        candCount = candCount + 1
        ReDim Preserve candDocIdx(1 To candCount)
        ReDim Preserve candLineIdx(1 To candCount)
        candDocIdx(candCount) = d
        candLineIdx(candCount) = l
      End If
    Next l
  Next k

  If candCount = 0 Then
    outReason = "Khong co ma " & task.itemCode & " (hoac da dung het) trong PDF"
    Exit Function
  End If

  ' TH1: Kiem tra xem co 1 Line don le nao co Pack Quantity = Qty khong
  For k = 1 To candCount
    d = candDocIdx(k)
    l = candLineIdx(k)
    If Abs(docs(d).lines(l).packQty - task.qty) <= EPSILON Then
      docs(d).lines(l).used = True
      outWh = NormalizeWhCode(docs(d).lines(l).wh)
      outIsSplit = False
      MatchRowAgainstPdfDocs = True
      Exit Function
    End If
  Next k

  ' TH2: Qty > Pack Quantity dot 1 -> Do tim to hop cac Line (Dot 1 + Dot 2 + ...) co tong = Qty
  Dim chosenMask() As Boolean
  ReDim chosenMask(1 To candCount)

  If Not FindExactLineSubset(docs, candDocIdx, candLineIdx, candCount, 1, task.qty, chosenMask) Then
    Dim totalAvail As Double
    totalAvail = 0
    For k = 1 To candCount
      totalAvail = totalAvail + docs(candDocIdx(k)).lines(candLineIdx(k)).packQty
    Next k
    outReason = "Tong Pack Quantity trong PDF = " & FormatNumberClean(totalAvail) & " (khac Qty = " & FormatNumberClean(task.qty) & ")"
    Exit Function
  End If

  ' Danh dau cac Line da chon la used = True va gom nhom so luong theo tung kho WH
  Dim whOrder() As String, whTotals() As Double, whCount As Long
  whCount = 0

  For k = 1 To candCount
    If chosenMask(k) Then
      d = candDocIdx(k)
      l = candLineIdx(k)
      docs(d).lines(l).used = True

      Dim wCode As String, qLine As Double
      wCode = NormalizeWhCode(docs(d).lines(l).wh)
      qLine = docs(d).lines(l).packQty

      Dim wPos As Long, foundW As Long
      foundW = 0
      For wPos = 1 To whCount
        If StrComp(whOrder(wPos), wCode, vbTextCompare) = 0 Then
          foundW = wPos
          Exit For
        End If
      Next wPos

      If foundW = 0 Then
        whCount = whCount + 1
        ReDim Preserve whOrder(1 To whCount)
        ReDim Preserve whTotals(1 To whCount)
        whOrder(whCount) = wCode
        whTotals(whCount) = qLine
      Else
        whTotals(foundW) = whTotals(foundW) + qLine
      End If
    End If
  Next k

  If whCount = 0 Then
    outReason = "Khong lay duoc ma kho WH tu PDF"
    Exit Function
  End If

  ' Neu tat ca cac dot deu nam chung 1 kho duy nhat (VD cung kho 60)
  If whCount = 1 Then
    outWh = whOrder(1)
    outIsSplit = False
    MatchRowAgainstPdfDocs = True
    Exit Function
  End If

  ' Neu nam o >= 2 kho khac nhau -> Quy doi so luong moi kho ra SO KIEN (*=WH;*=WH)
  Dim packQtySpec As Double
  packQtySpec = ResolvePackQtyForItem(task.itemCode, task.pcsPerPkg, ws.Parent)

  Dim pIdx As Long, partStr As String, pkgVal As Double
  outWh = ""
  For pIdx = 1 To whCount
    If packQtySpec > 0 Then
      pkgVal = Round(whTotals(pIdx) / packQtySpec, 2)
    Else
      pkgVal = Round(whTotals(pIdx), 2)
    End If
    partStr = FormatNumberClean(pkgVal) & "=" & whOrder(pIdx)
    If Len(outWh) > 0 Then outWh = outWh & ";"
    outWh = outWh & partStr
  Next pIdx

  outIsSplit = True
  MatchRowAgainstPdfDocs = True
End Function

' De quy quay lui tim to hop cac Line (Dot 1 + Dot 2 + ...) co tong Pack Quantity = remainingQty
Private Function FindExactLineSubset( _
  ByRef docs() As ParsedPdfDoc, _
  ByRef candDocIdx() As Long, _
  ByRef candLineIdx() As Long, _
  ByVal candCount As Long, _
  ByVal pos As Long, _
  ByVal remainingQty As Double, _
  ByRef chosenMask() As Boolean _
) As Boolean
  If Abs(remainingQty) <= EPSILON Then
    FindExactLineSubset = True
    Exit Function
  End If
  If pos > candCount Or remainingQty < -EPSILON Then
    Exit Function
  End If

  Dim curLineQty As Double
  curLineQty = docs(candDocIdx(pos)).lines(candLineIdx(pos)).packQty

  ' Nhanh 1: Chon Line tai vi tri pos (neu Pack Quantity <= remainingQty)
  If curLineQty > 0 And curLineQty <= remainingQty + EPSILON Then
    chosenMask(pos) = True
    If FindExactLineSubset(docs, candDocIdx, candLineIdx, candCount, pos + 1, remainingQty - curLineQty, chosenMask) Then
      FindExactLineSubset = True
      Exit Function
    End If
    chosenMask(pos) = False
  End If

  ' Nhanh 2: Bo qua Line tai vi tri pos, thu Line tiep theo
  If FindExactLineSubset(docs, candDocIdx, candLineIdx, candCount, pos + 1, remainingQty, chosenMask) Then
    FindExactLineSubset = True
    Exit Function
  End If
End Function

' ================= TRA CUU QUY CACH DONG GOI (PACK_QTY) =================

Private Function ResolvePackQtyForItem(ByVal itemCode As String, ByVal sheetPcsPerPkg As Double, ByVal wb As Workbook) As Double
  ' 1. Uu tien cot Pcs/pkg tren sheet KE_HOACH_XUAT_HANG neu co
  If sheetPcsPerPkg > 0 Then
    ResolvePackQtyForItem = sheetPcsPerPkg
    Exit Function
  End If

  ' 2. Khoi tao cache quy cach dong goi (tu sheet METADATA/QUY_CACH hoac tu Supabase metadata_quy_cach)
  If mPackSpecCache Is Nothing Then
    Set mPackSpecCache = CreateObject("Scripting.Dictionary")
    mPackSpecCache.CompareMode = 1
    LoadPackSpecFromWorkbook wb, mPackSpecCache
    LoadPackSpecFromSupabase mPackSpecCache
  End If

  Dim code As String, feat As String
  code = Trim$(itemCode)
  If mPackSpecCache.Exists("MA:" & code) Then
    ResolvePackQtyForItem = CDbl(mPackSpecCache("MA:" & code))
    Exit Function
  End If

  feat = ExtractFeatureCode(code)
  If Len(feat) > 0 And mPackSpecCache.Exists("FEAT:" & feat) Then
    ResolvePackQtyForItem = CDbl(mPackSpecCache("FEAT:" & feat))
    Exit Function
  End If
End Function

Private Function ExtractFeatureCode(ByVal itemCode As String) As String
  Dim s As String
  s = Trim$(itemCode)
  If Left$(s, 4) = "1220" Then
    ExtractFeatureCode = "1220"
  ElseIf Len(s) >= 5 Then
    ExtractFeatureCode = Mid$(s, 2, 4)
  Else
    ExtractFeatureCode = s
  End If
End Function

Private Sub LoadPackSpecFromWorkbook(ByVal wb As Workbook, ByVal dict As Object)
  Dim ws As Worksheet, arr As Variant, headers As Variant
  Dim colMa As Long, colFeat As Long, colPack As Long
  Dim i As Long, nRows As Long, ma As String, ft As String, pq As Double

  On Error Resume Next
  For Each ws In wb.Worksheets
    Dim nm As String
    nm = NormHeaderStr(ws.name)
    If InStr(1, nm, "metadata") > 0 Or InStr(1, nm, "quycach") > 0 Then
      arr = ws.UsedRange.Value2
      If IsArray(arr) Then
        nRows = UBound(arr, 1)
        If nRows >= 2 Then
          headers = GetHeaderRowArray(arr)
          colMa = FindHeaderCol(headers, Array("mahang", "itemcode", "lpvnitemcode", "stockcode"))
          colFeat = FindHeaderCol(headers, Array("feature", "mafeature"))
          colPack = FindHeaderCol(headers, Array("packqty", "soluongdonggoi", "pcspkg", "pcsperpkg", "quycach"))
          If colPack > 0 Then
            For i = 2 To nRows
              pq = ParseDoubleSafe(arr(i, colPack))
              If pq > 0 Then
                If colMa > 0 Then
                  ma = Trim$(CStr(arr(i, colMa) & ""))
                  If Len(ma) > 0 Then dict("MA:" & ma) = pq
                End If
                If colFeat > 0 Then
                  ft = Trim$(CStr(arr(i, colFeat) & ""))
                  If Len(ft) > 0 And Not dict.Exists("FEAT:" & ft) Then dict("FEAT:" & ft) = pq
                End If
              End If
            Next i
          End If
        End If
      End If
    End If
  Next ws
  On Error GoTo 0
End Sub

Private Sub LoadPackSpecFromSupabase(ByVal dict As Object)
  On Error GoTo IgnoreErr
  Dim http As Object, resp As String
  Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
  http.Open "GET", SUPABASE_URL & "/rest/v1/metadata_quy_cach?select=ma_hang,feature,item_code,pack_qty", False
  http.SetRequestHeader "apikey", SUPABASE_ANON_KEY
  http.SetRequestHeader "Authorization", "Bearer " & SUPABASE_ANON_KEY
  http.SetRequestHeader "Accept", "application/json"
  http.Send

  If http.Status < 200 Or http.Status >= 300 Then Exit Sub
  resp = CStr(http.ResponseText)

  ' Parse nhanh cac object {"ma_hang":"...","feature":"...","item_code":"...","pack_qty":...}
  Dim pos As Long, objEnd As Long, chunk As String
  Dim ma As String, ft As String, ic As String, pqStr As String, pq As Double
  pos = InStr(1, resp, "{")
  Do While pos > 0
    objEnd = InStr(pos, resp, "}")
    If objEnd = 0 Then Exit Do
    chunk = Mid$(resp, pos, objEnd - pos + 1)
    ma = ExtractJsonStrField(chunk, "ma_hang")
    ft = ExtractJsonStrField(chunk, "feature")
    ic = ExtractJsonStrField(chunk, "item_code")
    pqStr = ExtractJsonNumField(chunk, "pack_qty")
    pq = Val(pqStr)
    If pq > 0 Then
      If Len(ma) > 0 Then dict("MA:" & ma) = pq
      If Len(ft) > 0 Then
        If Not dict.Exists("FEAT:" & ft) Then dict("FEAT:" & ft) = pq
      End If
      If Len(ic) > 0 Then
        If Not dict.Exists("FEAT:" & ic) Then dict("FEAT:" & ic) = pq
      End If
    End If
    pos = InStr(objEnd + 1, resp, "{")
  Loop
IgnoreErr:
End Sub

Private Function ExtractJsonStrField(ByVal jsonObj As String, ByVal key As String) As String
  Dim pat As String, p As Long, p2 As Long
  pat = """" & key & """:"""
  p = InStr(1, jsonObj, pat)
  If p = 0 Then Exit Function
  p = p + Len(pat)
  p2 = InStr(p, jsonObj, """")
  If p2 > p Then ExtractJsonStrField = Trim$(Mid$(jsonObj, p, p2 - p))
End Function

Private Function ExtractJsonNumField(ByVal jsonObj As String, ByVal key As String) As String
  Dim pat As String, p As Long, i As Long, ch As String, out As String
  pat = """" & key & """:"
  p = InStr(1, jsonObj, pat)
  If p = 0 Then Exit Function
  p = p + Len(pat)
  For i = p To Len(jsonObj)
    ch = Mid$(jsonObj, i, 1)
    If (ch >= "0" And ch <= "9") Or ch = "." Or ch = "-" Then
      out = out & ch
    ElseIf Len(out) > 0 Then
      Exit For
    End If
  Next i
  ExtractJsonNumField = out
End Function

' ================= QUET FILE PDF TU OUTLOOK & THU MUC =================

Private Sub CollectPdfsFromOutlook( _
  ByVal neededTokens As Object, _
  ByVal outPdfFiles As Object, _
  ByVal targetFolder As String _
)
  Dim olApp As Object, olNs As Object, saveDir As String
  Dim store As Object, rootFolder As Object, inboxFolder As Object
  Dim activeExp As Object, selItem As Object

  On Error Resume Next
  Set olApp = GetObject(, "Outlook.Application")
  If olApp Is Nothing Then
    Set olApp = CreateObject("Outlook.Application")
  End If
  On Error GoTo 0

  If olApp Is Nothing Then Exit Sub

  If Len(targetFolder) > 0 Then
    saveDir = targetFolder
  Else
    saveDir = GetSynDataFolder()
  End If

  On Error Resume Next
  Set olNs = olApp.GetNamespace("MAPI")
  If olNs Is Nothing Then Exit Sub

  ' 0. Uu tien 1: Kiem tra email dang duoc mo / chon tren Outlook (neu nguoi dung dang xem dung mail)
  Set activeExp = olApp.ActiveExplorer
  If Not activeExp Is Nothing Then
    If activeExp.Selection.Count > 0 Then
      For Each selItem In activeExp.Selection
        If selItem.Class = 43 Then
          ScanOneEmailForMatchingPdfs selItem, neededTokens, outPdfFiles, saveDir
        End If
      Next selItem
    End If
    If outPdfFiles.Count >= neededTokens.Count Then Exit Sub

    ' Kiem tra thu muc hien tai dang mo tren man hinh Outlook (VD thu muc 'Chi Hong CS')
    If Not activeExp.CurrentFolder Is Nothing Then
      ScanOutlookFolderRecursive activeExp.CurrentFolder, neededTokens, outPdfFiles, saveDir, True, True
    End If
    If outPdfFiles.Count >= neededTokens.Count Then Exit Sub
  End If

  ' 1. Quet Inbox mac dinh va cac subfolder (uu tien nguoi gui Hong Pham trong 60 ngay)
  Set inboxFolder = olNs.GetDefaultFolder(6) ' 6 = olFolderInbox
  If Not inboxFolder Is Nothing Then
    ScanOutlookFolderRecursive inboxFolder, neededTokens, outPdfFiles, saveDir, True, True
  End If
  If outPdfFiles.Count >= neededTokens.Count Then Exit Sub

  ' 2. Quet them cac Store/Account khac trong Outlook (bao gom moi thu muc con)
  For Each store In olNs.Stores
    Set rootFolder = store.GetRootFolder
    If Not rootFolder Is Nothing Then
      ScanOutlookSubfoldersOnly rootFolder, neededTokens, outPdfFiles, saveDir, True, True
    End If
    If outPdfFiles.Count >= neededTokens.Count Then Exit Sub
  Next store

  ' 3. Fallback: Neu van chua du file, mo rong quet toan bo email trong Inbox (khong loc nguoi gui)
  If outPdfFiles.Count < neededTokens.Count And Not inboxFolder Is Nothing Then
    ScanOutlookFolderRecursive inboxFolder, neededTokens, outPdfFiles, saveDir, True, False
  End If
  On Error GoTo 0
End Sub

Private Sub ScanOutlookSubfoldersOnly( _
  ByVal parentFolder As Object, _
  ByVal neededTokens As Object, _
  ByVal outPdfFiles As Object, _
  ByVal cacheDir As String, _
  ByVal recentOnly As Boolean, _
  ByVal filterSender As Boolean _
)
  Dim subF As Object, fName As String
  On Error Resume Next
  For Each subF In parentFolder.Folders
    fName = LCase$(CStr(subF.name))
    ' Bo qua cac thu muc rac/nhap/da xoa de tang toc
    If InStr(1, fName, "deleted") = 0 And InStr(1, fName, "junk") = 0 And _
       InStr(1, fName, "trash") = 0 And InStr(1, fName, "outbox") = 0 Then
      ScanOutlookFolderRecursive subF, neededTokens, outPdfFiles, cacheDir, recentOnly, filterSender
      If outPdfFiles.Count >= neededTokens.Count Then Exit For
    End If
  Next subF
  On Error GoTo 0
End Sub

Private Sub ScanOutlookFolderRecursive( _
  ByVal folder As Object, _
  ByVal neededTokens As Object, _
  ByVal outPdfFiles As Object, _
  ByVal cacheDir As String, _
  ByVal recentOnly As Boolean, _
  ByVal filterSender As Boolean _
)
  Dim items As Object, it As Object
  Dim cutoffDate As Date, itDate As Date

  On Error Resume Next
  Set items = folder.items
  If Not items Is Nothing Then
    cutoffDate = Date - OUTLOOK_LOOKBACK_DAYS

    ' Sap xep theo ReceivedTime giam dan de doc cac email moi nhat truoc
    items.Sort "[ReceivedTime]", True

    For Each it In items
      If it.Class = 43 Then ' 43 = olMail
        If recentOnly Then
          itDate = 0
          itDate = it.ReceivedTime
          If itDate > 0 And itDate < cutoffDate Then
            ' Do da sap xep giam dan, neu gap email cu hon moc 60 ngay thi dung quet thu muc nay
            Exit For
          End If
        End If

        Dim senderOk As Boolean
        If filterSender Then
          senderOk = IsTargetSender(it)
        Else
          senderOk = True
        End If

        If senderOk Then
          ScanOneEmailForMatchingPdfs it, neededTokens, outPdfFiles, cacheDir
          If outPdfFiles.Count >= neededTokens.Count Then Exit For
        End If
      End If
    Next it
  End If

  If outPdfFiles.Count >= neededTokens.Count Then Exit Sub

  Dim subFolder As Object, fName As String
  For Each subFolder In folder.Folders
    fName = LCase$(CStr(subFolder.name))
    If InStr(1, fName, "deleted") = 0 And InStr(1, fName, "junk") = 0 And _
       InStr(1, fName, "trash") = 0 And InStr(1, fName, "outbox") = 0 Then
      ScanOutlookFolderRecursive subFolder, neededTokens, outPdfFiles, cacheDir, recentOnly, filterSender
      If outPdfFiles.Count >= neededTokens.Count Then Exit For
    End If
  Next subFolder
  On Error GoTo 0
End Sub

' Quet 1 email cu the va trich xuat cac attachment PDF co chua ma PO/SO can tim
Private Sub ScanOneEmailForMatchingPdfs( _
  ByVal it As Object, _
  ByVal neededTokens As Object, _
  ByVal outPdfFiles As Object, _
  ByVal cacheDir As String _
)
  Dim att As Object, attName As String, savePath As String, tok As Variant
  Dim isPdf As Boolean, fso As Object

  On Error Resume Next
  If it.Attachments.Count = 0 Then Exit Sub

  Set fso = CreateObject("Scripting.FileSystemObject")

  For Each att In it.Attachments
    attName = Trim$(CStr(att.fileName & ""))
    isPdf = False
    If LCase$(Right$(attName, 4)) = ".pdf" Then
      isPdf = True
    ElseIf InStr(1, LCase$(attName), ".pdf", vbTextCompare) > 0 Then
      isPdf = True
    End If

    If isPdf Then
      For Each tok In neededTokens.Keys
        If FileNameContainsOrderToken(attName, CStr(tok)) Then
          savePath = cacheDir & Application.PathSeparator & SanitizeFileName(attName)
          If Not fso.FileExists(savePath) Then
            att.SaveAsFile savePath
          End If
          If fso.FileExists(savePath) Then
            outPdfFiles(LCase$(attName)) = savePath
          End If
          Exit For
        End If
      Next tok
    End If
  Next att
  On Error GoTo 0
End Sub

' Kiem tra email co phai do Hong Pham <hong.pham@leggett.com> gui hay khong
Private Function IsTargetSender(ByVal it As Object) As Boolean
  On Error Resume Next
  Dim sName As String, sAddr As String
  sName = LCase$(Trim$(CStr(it.SenderName & "")))
  sAddr = LCase$(Trim$(CStr(it.SenderEmailAddress & "")))

  ' 1. Kiem tra dia chi email hoac ten hien thi thong thuong
  If InStr(1, sAddr, "hong.pham@leggett.com") > 0 Or _
     InStr(1, sAddr, "hong.pham") > 0 Or _
     (InStr(1, sName, "hong") > 0 And InStr(1, sName, "pham") > 0) Then
    IsTargetSender = True
    Exit Function
  End If

  ' 2. Kiem tra Exchange User (truong hop noi bo cong ty dung Outlook Exchange/O365)
  Dim senderObj As Object, exUser As Object
  Set senderObj = it.Sender
  If Not senderObj Is Nothing Then
    Set exUser = senderObj.GetExchangeUser
    If Not exUser Is Nothing Then
      Dim exSmtp As String
      exSmtp = LCase$(Trim$(CStr(exUser.PrimarySmtpAddress & "")))
      If InStr(1, exSmtp, "hong.pham@leggett.com") > 0 Or InStr(1, exSmtp, "hong.pham") > 0 Then
        IsTargetSender = True
        Exit Function
      End If
    End If
  End If

  ' 3. Kiem tra thuoc tinh PR_SENDER_SMTP_ADDRESS (dung khi Outlook chay trong noi bo Exchange)
  Dim pa As Object, smtpAddr As String
  Set pa = it.PropertyAccessor
  If Not pa Is Nothing Then
    smtpAddr = LCase$(Trim$(CStr(pa.GetProperty("http://schemas.microsoft.com/mapi/proptag/0x5D01001F") & "")))
    If InStr(1, smtpAddr, "hong.pham@leggett.com") > 0 Or InStr(1, smtpAddr, "hong.pham") > 0 Then
      IsTargetSender = True
      Exit Function
    End If
  End If
  On Error GoTo 0
End Function

' Quet cac file PDF trong thu muc co dinh bang FileSystemObject (khong dung Dir$ de tranh loi tren thu muc OneDrive)
Private Sub CollectPdfsFromFixedFolder(ByVal folderPath As String, ByVal neededTokens As Object, ByVal outPdfFiles As Object)
  If Len(Trim$(folderPath)) = 0 Then Exit Sub

  Dim fso As Object, fld As Object, fil As Object
  Dim fName As String, tok As Variant

  On Error Resume Next
  Set fso = CreateObject("Scripting.FileSystemObject")
  If fso Is Nothing Then Exit Sub
  If Not fso.FolderExists(folderPath) Then Exit Sub

  Set fld = fso.GetFolder(folderPath)
  If fld Is Nothing Then Exit Sub

  For Each fil In fld.Files
    fName = fil.name
    If LCase$(Right$(fName, 4)) = ".pdf" Then
      For Each tok In neededTokens.Keys
        If FileNameContainsOrderToken(fName, CStr(tok)) Then
          outPdfFiles(LCase$(fName)) = fil.path
          Exit For
        End If
      Next tok
    End If
  Next fil
  On Error GoTo 0
End Sub

Private Sub CollectPdfsFromFolderPicker(ByVal neededTokens As Object, ByVal outPdfFiles As Object)
  Dim fd As Object, folderPath As String
  Set fd = Application.FileDialog(4) ' 4 = msoFileDialogFolderPicker
  fd.Title = "Chon thu muc chua cac file PDF Packing List (pkl*-bh *.pdf)"
  If fd.Show <> -1 Then Exit Sub
  folderPath = fd.SelectedItems(1)
  CollectPdfsFromFixedFolder folderPath, neededTokens, outPdfFiles
End Sub

' Macro chay doc lap de tai TOAN BO cac file PDF trong email cua Hong Pham ve SynData
Private Sub RunDownloadAllPdfsFromHongPham()
  Dim olApp As Object, olNs As Object
  Dim inboxFolder As Object, store As Object, rootFolder As Object
  Dim targetFolder As String
  Dim newCount As Long, existCount As Long

  On Error GoTo FailOl

  targetFolder = GetSynDataFolder()
  If Len(targetFolder) = 0 Then
    MsgBox "Khong the tao hoac truy cap thu muc SynData:" & vbCrLf & DEFAULT_SYNDATA_FOLDER, vbCritical, "FGRP - Dong Bo PDF"
    Exit Sub
  End If

  Application.StatusBar = "FGRP: Dang ket noi Outlook de tai toan bo PDF tu Hong Pham <" & OUTLOOK_SENDER_EMAIL & ">..."

  On Error Resume Next
  Set olApp = GetObject(, "Outlook.Application")
  If olApp Is Nothing Then
    Set olApp = CreateObject("Outlook.Application")
  End If
  On Error GoTo 0

  If olApp Is Nothing Then
    Application.StatusBar = False
    MsgBox "Khong the khoi dong hoac ket noi ung dung Outlook tren may tinh." & vbCrLf & _
           "Anh vui long mo Outlook truoc roi thu lai nhe.", vbExclamation, "FGRP - Dong Bo PDF"
    Exit Sub
  End If

  Set olNs = olApp.GetNamespace("MAPI")
  If olNs Is Nothing Then
    Application.StatusBar = False
    MsgBox "Khong the truy cap Namespace MAPI cua Outlook.", vbCritical, "FGRP - Dong Bo PDF"
    Exit Sub
  End If

  newCount = 0
  existCount = 0

  ' 0. Uu tien email dang duoc mo / chon tren Outlook hoac thu muc dang duoc nguoi dung xem
  Dim activeExp As Object, selItem As Object
  Set activeExp = olApp.ActiveExplorer
  If Not activeExp Is Nothing Then
    If activeExp.Selection.Count > 0 Then
      For Each selItem In activeExp.Selection
        If selItem.Class = 43 Then
          If IsTargetSender(selItem) Then
            DownloadAttachmentsFromOneEmail selItem, targetFolder, newCount, existCount
          End If
        End If
      Next selItem
    End If
    If Not activeExp.CurrentFolder Is Nothing Then
      DownloadAllPdfsFromFolderRecursive activeExp.CurrentFolder, targetFolder, newCount, existCount, True
    End If
  End If

  Set inboxFolder = olNs.GetDefaultFolder(6) ' 6 = olFolderInbox
  If Not inboxFolder Is Nothing Then
    DownloadAllPdfsFromFolderRecursive inboxFolder, targetFolder, newCount, existCount, True
  End If

  For Each store In olNs.Stores
    Set rootFolder = store.GetRootFolder
    If Not rootFolder Is Nothing Then
      DownloadAllPdfsSubfoldersOnly rootFolder, targetFolder, newCount, existCount, True
    End If
  Next store

  Application.StatusBar = False

  Dim msg As String
  msg = "HOAN TAT TAI TOAN BO PDF TU OUTLOOK CUA HONG PHAM!" & vbCrLf & vbCrLf & _
        "Nguoi gui: " & OUTLOOK_SENDER_NAME & " <" & OUTLOOK_SENDER_EMAIL & ">" & vbCrLf & _
        "Thu muc luu: " & targetFolder & vbCrLf & vbCrLf & _
        "- File tai moi ve: " & newCount & " file" & vbCrLf & _
        "- File da co san (khong can tai lai): " & existCount & " file" & vbCrLf & vbCrLf & _
        "He thong da luu toan bo file truc tiep vao o dia." & vbCrLf & _
        "Khi doi chieu WH, he thong se doc file tu thu muc nay ma KHONG lo tran mang hay qua tai bo nho!"
  MsgBox msg, vbInformation, "FGRP - Dong Bo PDF SynData"
  Exit Sub

FailOl:
  Application.StatusBar = False
  MsgBox "Loi khi tai toan bo PDF tu Outlook:" & vbCrLf & Err.Description, vbCritical, "FGRP - Dong Bo PDF"
End Sub

Private Sub DownloadAllPdfsSubfoldersOnly( _
  ByVal parentFolder As Object, _
  ByVal targetFolder As String, _
  ByRef newCount As Long, _
  ByRef existCount As Long, _
  ByVal recentOnly As Boolean _
)
  Dim subF As Object, fName As String
  On Error Resume Next
  For Each subF In parentFolder.Folders
    fName = LCase$(CStr(subF.name))
    If InStr(1, fName, "deleted") = 0 And InStr(1, fName, "junk") = 0 And _
       InStr(1, fName, "trash") = 0 And InStr(1, fName, "outbox") = 0 Then
      DownloadAllPdfsFromFolderRecursive subF, targetFolder, newCount, existCount, recentOnly
    End If
  Next subF
  On Error GoTo 0
End Sub

Private Sub DownloadAllPdfsFromFolderRecursive( _
  ByVal folder As Object, _
  ByVal targetFolder As String, _
  ByRef newCount As Long, _
  ByRef existCount As Long, _
  ByVal recentOnly As Boolean _
)
  Dim items As Object, it As Object, att As Object
  Dim cutoffDate As Date, itDate As Date
  Dim attName As String, savePath As String
  Dim isPdf As Boolean

  On Error Resume Next
  Set items = folder.items
  If Not items Is Nothing Then
    cutoffDate = Date - OUTLOOK_LOOKBACK_DAYS
    items.Sort "[ReceivedTime]", True

    For Each it In items
      If it.Class = 43 Then ' 43 = olMail
        If recentOnly Then
          itDate = 0
          itDate = it.ReceivedTime
          If itDate > 0 And itDate < cutoffDate Then
            Exit For
          End If
        End If

        If IsTargetSender(it) Then
          DownloadAttachmentsFromOneEmail it, targetFolder, newCount, existCount
        End If
      End If
    Next it
  End If

  Dim subFolder As Object
  For Each subFolder In folder.Folders
    Dim fName As String
    fName = LCase$(CStr(subFolder.name))
    If InStr(1, fName, "deleted") = 0 And InStr(1, fName, "junk") = 0 And _
       InStr(1, fName, "trash") = 0 And InStr(1, fName, "outbox") = 0 Then
      DownloadAllPdfsFromFolderRecursive subFolder, targetFolder, newCount, existCount, recentOnly
    End If
  Next subFolder
  On Error GoTo 0
End Sub

' Luu toan bo tep dinh kem PDF tu 1 email vao thu muc SynData
Private Sub DownloadAttachmentsFromOneEmail( _
  ByVal it As Object, _
  ByVal targetFolder As String, _
  ByRef newCount As Long, _
  ByRef existCount As Long _
)
  Dim att As Object, attName As String, savePath As String
  Dim isPdf As Boolean, fso As Object

  On Error Resume Next
  If it.Attachments.Count = 0 Then Exit Sub

  Set fso = CreateObject("Scripting.FileSystemObject")

  For Each att In it.Attachments
    attName = Trim$(CStr(att.fileName & ""))
    isPdf = False
    If LCase$(Right$(attName, 4)) = ".pdf" Then
      isPdf = True
    ElseIf InStr(1, LCase$(attName), ".pdf", vbTextCompare) > 0 Then
      isPdf = True
    End If

    If isPdf Then
      savePath = targetFolder & Application.PathSeparator & SanitizeFileName(attName)
      If fso.FileExists(savePath) Then
        existCount = existCount + 1
      Else
        att.SaveAsFile savePath
        If fso.FileExists(savePath) Then
          newCount = newCount + 1
        End If
      End If
    End If
  Next att
  On Error GoTo 0
End Sub

Private Function GetSynDataFolder() As String
  Dim fso As Object
  On Error Resume Next
  Set fso = CreateObject("Scripting.FileSystemObject")

  ' 1. Uu tien DEFAULT_SYNDATA_FOLDER neu thu muc ton tai
  If Not fso Is Nothing Then
    If fso.FolderExists(DEFAULT_SYNDATA_FOLDER) Then
      GetSynDataFolder = DEFAULT_SYNDATA_FOLDER
      Exit Function
    End If
  End If

  ' 2. Tim theo cac bien moi truong OneDrive / USERPROFILE cua may tinh hien tai
  Dim envKeys As Variant, k As Variant, baseDir As String, candPath As String
  envKeys = Array("OneDriveCommercial", "OneDrive", "USERPROFILE", "OneDriveConsumer")
  For Each k In envKeys
    baseDir = Environ$(CStr(k))
    If Len(baseDir) > 0 Then
      candPath = baseDir & Application.PathSeparator & "SynData"
      If fso.FolderExists(candPath) Then
        GetSynDataFolder = candPath
        Exit Function
      End If
      candPath = baseDir & Application.PathSeparator & "OneDrive - Leggett & Platt, Incorporated" & Application.PathSeparator & "SynData"
      If fso.FolderExists(candPath) Then
        GetSynDataFolder = candPath
        Exit Function
      End If
    End If
  Next k

  ' 3. Neu chua co, tu dong tao tai DEFAULT_SYNDATA_FOLDER
  EnsureDirectoryTree DEFAULT_SYNDATA_FOLDER
  If fso.FolderExists(DEFAULT_SYNDATA_FOLDER) Then
    GetSynDataFolder = DEFAULT_SYNDATA_FOLDER
    Exit Function
  End If

  ' 4. Fallback temp
  GetSynDataFolder = GetPdfCacheFolder()
End Function

Private Sub EnsureDirectoryTree(ByVal folderPath As String)
  Dim fso As Object
  On Error Resume Next
  Set fso = CreateObject("Scripting.FileSystemObject")
  If Not fso Is Nothing Then
    If Not fso.FolderExists(folderPath) Then
      CreateFolderRecursive fso, folderPath
    End If
  End If
  On Error GoTo 0
End Sub

Private Sub CreateFolderRecursive(ByVal fso As Object, ByVal folderPath As String)
  If fso.FolderExists(folderPath) Then Exit Sub
  Dim parentPath As String
  parentPath = fso.GetParentFolderName(folderPath)
  If Len(parentPath) > 0 And Not fso.FolderExists(parentPath) Then
    CreateFolderRecursive fso, parentPath
  End If
  On Error Resume Next
  fso.CreateFolder folderPath
  On Error GoTo 0
End Sub

Private Function GetPdfCacheFolder() As String
  Dim p As String, fso As Object
  p = Environ$("TEMP")
  If Len(p) = 0 Then p = ThisWorkbook.path
  p = p & Application.PathSeparator & "FGRP_PDF_Cache"
  Set fso = CreateObject("Scripting.FileSystemObject")
  If Not fso.FolderExists(p) Then
    EnsureDirectoryTree p
  End If
  GetPdfCacheFolder = p
End Function

' ================= BO GIAI MA PDF TRUC TIEP (PURE-VBA FLATEDECODE + TOUNICODE) =================

Private Sub ParsePackingListPdf(ByVal pdfPath As String, ByRef outDoc As ParsedPdfDoc)
  Dim rawBytes() As Byte, fSize As Long, fNum As Integer
  Dim pdfStr As String

  outDoc.filePath = pdfPath
  outDoc.fileName = GetFileNameOnly(pdfPath)
  outDoc.ordersNo = ""
  outDoc.salesOrderNo = ""
  outDoc.lineCount = 0
  outDoc.isValid = False

  fSize = FileLen(pdfPath)
  If fSize < 64 Then Exit Sub

  fNum = FreeFile
  ReDim rawBytes(0 To fSize - 1)
  Open pdfPath For Binary Access Read As #fNum
  Get #fNum, , rawBytes
  Close #fNum

  pdfStr = BytesToLatin1String(rawBytes, 0, fSize)

  ' 1. Thu thap vi tri va noi dung cac Object (N 0 obj ... endobj)
  Dim objDict As Object, objStreamBytes As Object
  Set objDict = CreateObject("Scripting.Dictionary")
  Set objStreamBytes = CreateObject("Scripting.Dictionary")

  ParsePdfObjects rawBytes, pdfStr, objDict, objStreamBytes

  ' 2. Giai ma bang ma ToUnicode CMap cho tung Font (/9, /a, /b, /c...)
  Dim fontCmaps As Object
  Set fontCmaps = CreateObject("Scripting.Dictionary")
  fontCmaps.CompareMode = 0 ' BinaryCompare (phan biet hoa thuong ten font)

  BuildFontCmaps objDict, objStreamBytes, fontCmaps

  ' 3. Duyet tat ca cac Content Stream va trich xuat cac Token van ban kem toa do (X, Y)
  Dim tokens() As PdfToken, tokenCount As Long
  tokenCount = 0

  ExtractAllPageTokens objDict, objStreamBytes, fontCmaps, tokens, tokenCount

  ' 4. Phan tich Orders:, Sales Order: va Bang Line Items tu danh sach Tokens
  If tokenCount > 0 Then
    ExtractStructuredPackingList tokens, tokenCount, outDoc
  End If

  If outDoc.lineCount > 0 Or Len(outDoc.ordersNo) > 0 Or Len(outDoc.salesOrderNo) > 0 Then
    outDoc.isValid = True
  End If
End Sub

Private Sub ParsePdfObjects( _
  ByRef rawBytes() As Byte, _
  ByVal pdfStr As String, _
  ByVal objDict As Object, _
  ByVal objStreamBytes As Object _
)
  Dim pos As Long, endPos As Long, headerStart As Long
  Dim objId As Long, bodyStr As String
  Dim sPos As Long, ePos As Long, dataStart As Long, dataLen As Long

  pos = 1
  Do While pos <= Len(pdfStr)
    Dim matchPos As Long
    matchPos = InStr(pos, pdfStr, " 0 obj")
    If matchPos = 0 Then Exit Do

    ' Tim so Object ID ngay truoc " 0 obj"
    headerStart = matchPos - 1
    Do While headerStart >= 1
      Dim ch As String
      ch = Mid$(pdfStr, headerStart, 1)
      If ch < "0" Or ch > "9" Then Exit Do
      headerStart = headerStart - 1
    Loop
    objId = Val(Mid$(pdfStr, headerStart + 1, matchPos - headerStart - 1))

    endPos = InStr(matchPos + 6, pdfStr, "endobj")
    If endPos = 0 Then Exit Do

    bodyStr = Mid$(pdfStr, matchPos + 6, endPos - (matchPos + 6))
    objDict(objId) = bodyStr

    ' Kiem tra neu object co stream (va KHONG phai TrueType FontFile2 co /Length1 lon)
    If InStr(1, bodyStr, "/Length1") = 0 Then
      sPos = InStr(1, bodyStr, "stream")
      If sPos > 0 Then
        ePos = InStr(sPos + 6, bodyStr, "endstream")
        If ePos > sPos Then
          ' Tinh vi tri byte bat dau sau "stream" + CR/LF
          dataStart = (matchPos + 6 - 1) + (sPos - 1) + 6
          Do While dataStart < UBound(rawBytes)
            If rawBytes(dataStart) = 13 And rawBytes(dataStart + 1) = 10 Then
              dataStart = dataStart + 2
              Exit Do
            ElseIf rawBytes(dataStart) = 10 Or rawBytes(dataStart) = 13 Then
              dataStart = dataStart + 1
              Exit Do
            ElseIf rawBytes(dataStart) = 32 Then
              dataStart = dataStart + 1
            Else
              Exit Do
            End If
          Loop
          Dim absEnd As Long
          absEnd = (matchPos + 6 - 1) + (ePos - 1) - 1
          Do While absEnd >= dataStart
            If rawBytes(absEnd) = 10 Or rawBytes(absEnd) = 13 Then
              absEnd = absEnd - 1
            Else
              Exit Do
            End If
          Loop
          dataLen = absEnd - dataStart + 1
          If dataLen > 2 Then
            Dim decStr As String
            If InStr(1, bodyStr, "/FlateDecode") > 0 Then
              decStr = InflateZlibToLatin1(rawBytes, dataStart, dataLen)
            Else
              decStr = BytesToLatin1String(rawBytes, dataStart, dataLen)
            End If
            If Len(decStr) > 0 Then objStreamBytes(objId) = decStr
          End If
        End If
      End If
    End If

    pos = endPos + 6
  Loop
End Sub

Private Sub BuildFontCmaps(ByVal objDict As Object, ByVal objStreamBytes As Object, ByVal fontCmaps As Object)
  Dim k As Variant, body As String
  Dim fontName As String, tuObjId As Long, cmapText As String
  Dim cmapDict As Object

  For Each k In objDict.Keys
    body = CStr(objDict(k))
    If InStr(1, body, "/Type") > 0 And InStr(1, body, "/Font") > 0 And InStr(1, body, "/ToUnicode") > 0 Then
      fontName = ExtractPdfSlashName(body, "/Name")
      tuObjId = ExtractPdfObjRef(body, "/ToUnicode")
      If Len(fontName) > 0 And tuObjId > 0 And objStreamBytes.Exists(tuObjId) Then
        cmapText = CStr(objStreamBytes(tuObjId))
        Set cmapDict = ParseToUnicodeCmap(cmapText)
        Set fontCmaps(fontName) = cmapDict
      End If
    End If
  Next k
End Sub

Private Function ParseToUnicodeCmap(ByVal cmapText As String) As Object
  Dim d As Object
  Set d = CreateObject("Scripting.Dictionary")

  Dim lines As Variant, i As Long, ln As String
  Dim mode As Long ' 0=none, 1=bfrange, 2=bfchar
  lines = Split(Replace(cmapText, vbCr, vbLf), vbLf)

  For i = LBound(lines) To UBound(lines)
    ln = Trim$(CStr(lines(i)))
    If Len(ln) > 0 Then
      If InStr(1, ln, "beginbfrange") > 0 Then
        mode = 1
      ElseIf InStr(1, ln, "endbfrange") > 0 Then
        mode = 0
      ElseIf InStr(1, ln, "beginbfchar") > 0 Then
        mode = 2
      ElseIf InStr(1, ln, "endbfchar") > 0 Then
        mode = 0
      ElseIf mode = 1 And Left$(ln, 1) = "<" Then
        ' Dang: <21> <21> <0052>
        Dim h1 As String, h2 As String, h3 As String
        Dim p1 As Long, p2 As Long, p3 As Long
        p1 = 1
        h1 = NextHexToken(ln, p1)
        h2 = NextHexToken(ln, p1)
        h3 = NextHexToken(ln, p1)
        If Len(h1) > 0 And Len(h2) > 0 And Len(h3) > 0 Then
          Dim cLo As Long, cHi As Long, cDst As Long, c As Long
          cLo = CLng("&H" & h1)
          cHi = CLng("&H" & h2)
          cDst = CLng("&H" & h3)
          For c = cLo To cHi
            d(c) = ChrW$(cDst + (c - cLo))
          Next c
        End If
      ElseIf mode = 2 And Left$(ln, 1) = "<" Then
        ' Dang: <21> <0052>
        Dim pChar As Long, hs As String, hd As String
        pChar = 1
        hs = NextHexToken(ln, pChar)
        hd = NextHexToken(ln, pChar)
        If Len(hs) > 0 And Len(hd) > 0 Then
          d(CLng("&H" & hs)) = ChrW$(CLng("&H" & hd))
        End If
      End If
    End If
  Next i

  Set ParseToUnicodeCmap = d
End Function

Private Function NextHexToken(ByVal s As String, ByRef startPos As Long) As String
  Dim pOpen As Long, pClose As Long
  pOpen = InStr(startPos, s, "<")
  If pOpen = 0 Then Exit Function
  pClose = InStr(pOpen + 1, s, ">")
  If pClose = 0 Then Exit Function
  NextHexToken = Trim$(Mid$(s, pOpen + 1, pClose - pOpen - 1))
  startPos = pClose + 1
End Function

Private Sub ExtractAllPageTokens( _
  ByVal objDict As Object, _
  ByVal objStreamBytes As Object, _
  ByVal fontCmaps As Object, _
  ByRef tokens() As PdfToken, _
  ByRef tokenCount As Long _
)
  Dim k As Variant, contentStr As String
  Dim pageIndex As Long
  pageIndex = 0

  For Each k In objStreamBytes.Keys
    contentStr = CStr(objStreamBytes(k))
    ' Content stream cua trang PDF chua BT ... ET va Tf / Tj / TJ
    If InStr(1, contentStr, "BT") > 0 And (InStr(1, contentStr, "Tj") > 0 Or InStr(1, contentStr, "TJ") > 0) Then
      pageIndex = pageIndex + 1
      ParseContentStreamTokens contentStr, fontCmaps, pageIndex, tokens, tokenCount
    End If
  Next k
End Sub

Private Sub ParseContentStreamTokens( _
  ByVal contentStr As String, _
  ByVal fontCmaps As Object, _
  ByVal pageIndex As Long, _
  ByRef tokens() As PdfToken, _
  ByRef tokenCount As Long _
)
  Dim lines As Variant, i As Long, ln As String
  Dim curFont As String, curCmap As Object
  Dim x As Double, y As Double, pageOffsetY As Double
  pageOffsetY = (pageIndex - 1) * 100000#

  lines = Split(Replace(contentStr, vbCr, vbLf), vbLf)
  For i = LBound(lines) To UBound(lines)
    ln = Trim$(CStr(lines(i)))
    If Len(ln) > 0 Then
      ' 1. Chon font: /9 179 Tf
      If Right$(ln, 3) = " Tf" And Left$(ln, 1) = "/" Then
        Dim spPos As Long
        spPos = InStr(2, ln, " ")
        If spPos > 1 Then
          curFont = Mid$(ln, 2, spPos - 2)
          If fontCmaps.Exists(curFont) Then
            Set curCmap = fontCmaps(curFont)
          Else
            Set curCmap = Nothing
          End If
        End If

      ' 2. Ma tran vi tri: a b c d e f Tm
      ElseIf Right$(ln, 3) = " Tm" Then
        Dim tmParts As Variant, nTm As Long
        tmParts = Split(ln, " ")
        nTm = UBound(tmParts)
        If nTm >= 5 Then
          x = Val(tmParts(nTm - 2))
          y = Val(tmParts(nTm - 1))
        End If

      ' 3. Dich chuyen tuong doi: dx dy Td hoac TD
      ElseIf Right$(ln, 3) = " Td" Or Right$(ln, 3) = " TD" Then
        Dim tdParts As Variant, nTd As Long
        tdParts = Split(ln, " ")
        nTd = UBound(tdParts)
        If nTd >= 2 Then
          x = x + Val(tdParts(nTd - 2))
          y = y - Val(tdParts(nTd - 1))
        End If

      ' 4. Lenh in chu: (...) Tj hoac [...] TJ
      ElseIf Right$(ln, 3) = " Tj" Or Right$(ln, 3) = " TJ" Or _
             Right$(ln, 2) = ")Tj" Or Right$(ln, 2) = "]TJ" Then
        Dim decoded As String
        decoded = Trim$(DecodePdfTextLine(ln, curCmap))
        If Len(decoded) > 0 Then
          tokenCount = tokenCount + 1
          ReDim Preserve tokens(1 To tokenCount)
          tokens(tokenCount).x = x
          tokens(tokenCount).y = pageOffsetY + y
          tokens(tokenCount).text = decoded
        End If
      End If
    End If
  Next i
End Sub

Private Function DecodePdfTextLine(ByVal ln As String, ByVal cmap As Object) As String
  Dim i As Long, n As Long, ch As String, inStrLit As Boolean, parenDepth As Long
  Dim rawCode As Long, out As String

  n = Len(ln)
  i = 1
  Do While i <= n
    ch = Mid$(ln, i, 1)
    If Not inStrLit Then
      If ch = "(" Then
        inStrLit = True
        parenDepth = 1
      End If
    Else
      If ch = "\" And i < n Then
        Dim nextCh As String
        nextCh = Mid$(ln, i + 1, 1)
        Select Case nextCh
          Case "(", ")", "\"
            rawCode = Asc(nextCh)
            i = i + 1
          Case "n"
            rawCode = 10
            i = i + 1
          Case "r"
            rawCode = 13
            i = i + 1
          Case "t"
            rawCode = 9
            i = i + 1
          Case Else
            rawCode = Asc(nextCh)
            i = i + 1
        End Select
        out = out & MapCharWithCmap(rawCode, cmap)
      ElseIf ch = "(" Then
        parenDepth = parenDepth + 1
        out = out & MapCharWithCmap(Asc(ch), cmap)
      ElseIf ch = ")" Then
        parenDepth = parenDepth - 1
        If parenDepth <= 0 Then
          inStrLit = False
        Else
          out = out & MapCharWithCmap(Asc(ch), cmap)
        End If
      Else
        out = out & MapCharWithCmap(Asc(ch), cmap)
      End If
    End If
    i = i + 1
  Loop

  DecodePdfTextLine = out
End Function

Private Function MapCharWithCmap(ByVal charCode As Long, ByVal cmap As Object) As String
  If Not cmap Is Nothing Then
    If cmap.Exists(charCode) Then
      MapCharWithCmap = CStr(cmap(charCode))
      Exit Function
    End If
  End If
  MapCharWithCmap = ChrW$(charCode)
End Function

' Phan tich Orders:, Sales Order: va bang Line Items tu mang tokens da giai ma
Private Sub ExtractStructuredPackingList( _
  ByRef tokens() As PdfToken, _
  ByVal tokenCount As Long, _
  ByRef outDoc As ParsedPdfDoc _
)
  Dim i As Long, j As Long, txt As String, ltxt As String

  ' 1. Tim Orders: va Sales Order: (ho tro Orders:, Ordes:, Order:, Sales Order:, PO:...)
  For i = 1 To tokenCount
    txt = tokens(i).text
    ltxt = LCase$(txt)

    If InStr(1, ltxt, "order") > 0 Or InStr(1, ltxt, "orde") > 0 Or InStr(1, ltxt, "po:") > 0 Then
      Dim ordVal As String
      ordVal = ExtractLongestDigitRun(txt)
      If Len(ordVal) >= 6 Then
        If InStr(1, ltxt, "sales") > 0 Then
          If Len(outDoc.salesOrderNo) = 0 Then outDoc.salesOrderNo = ordVal
        Else
          If Len(outDoc.ordersNo) = 0 Then outDoc.ordersNo = ordVal
        End If
      Else
        For j = 1 To tokenCount
          If j <> i And Abs(tokens(j).y - tokens(i).y) < 120 And tokens(j).x > tokens(i).x Then
            ordVal = ExtractLongestDigitRun(tokens(j).text)
            If Len(ordVal) >= 6 Then
              If InStr(1, ltxt, "sales") > 0 Then
                If Len(outDoc.salesOrderNo) = 0 Then outDoc.salesOrderNo = ordVal
              Else
                If Len(outDoc.ordersNo) = 0 Then outDoc.ordersNo = ordVal
              End If
              Exit For
            End If
          End If
        Next j
      End If
    End If
  Next i

  ' 2. Tim tat ca cac vi tri token bat dau Line (2-6 chu so: 000010, 000020, 10, 20... o cot trai x < 2000)
  Dim lineStarts() As Long, nLines As Long
  nLines = 0
  For i = 1 To tokenCount
    If tokens(i).x < 2000 And IsLineNoToken(tokens(i).text) Then
      nLines = nLines + 1
      ReDim Preserve lineStarts(1 To nLines)
      lineStarts(nLines) = i
    End If
  Next i

  ReDim outDoc.lines(1 To IIf(nLines > 0, nLines * 2 + 50, 100))
  outDoc.lineCount = 0

  Dim handledY() As Double, nHandledY As Long
  nHandledY = 0

  ' --- LAYER 1: Trich xuat cac Line theo vi tri so thu tu Line (000010, 000020...) ---
  If nLines > 0 Then
    For i = 1 To nLines
      Dim startIdx As Long, baseY As Double
      startIdx = lineStarts(i)
      baseY = tokens(startIdx).y

      ' Chi lay cac token nam cung dong ngang (Abs(y - baseY) < 140)
      ' Quet toan bo mang tokens de khong bi anh huong boi thu tu phat sinh lenh trong stream
      Dim rowTexts() As String, rowXs() As Double, rowCnt As Long
      rowCnt = 0
      For j = 1 To tokenCount
        If j <> startIdx And Abs(tokens(j).y - baseY) < 140 Then
          rowCnt = rowCnt + 1
          ReDim Preserve rowTexts(1 To rowCnt)
          ReDim Preserve rowXs(1 To rowCnt)
          rowTexts(rowCnt) = tokens(j).text
          rowXs(rowCnt) = tokens(j).x
        End If
      Next j

      If rowCnt > 0 Then
        ' Sap xep cac token theo toa do X tang dan tu trai sang phai
        SortTokensByX rowTexts, rowXs, rowCnt

        Dim prodCode As String, packQty As Double, whCode As String
        prodCode = ""
        packQty = 0
        whCode = ""

        ' 1. Tim Product Code uu tien trong cot x tu 2000 den 5500
        Dim r As Long
        For r = 1 To rowCnt
          If rowXs(r) >= 2000 And rowXs(r) <= 5500 Then
            Dim candCode As String
            candCode = CleanItemCode(FirstWordToken(rowTexts(r)))
            If Len(candCode) >= 6 Then
              prodCode = candCode
              Exit For
            End If
          End If
        Next r
        If Len(prodCode) = 0 Then
          For r = 1 To rowCnt
            Dim fbCode As String
            fbCode = CleanItemCode(FirstWordToken(rowTexts(r)))
            If IsProductCodeCandidate(fbCode) Then
              prodCode = fbCode
              Exit For
            End If
          Next r
        End If
        If Len(prodCode) = 0 Then prodCode = CleanItemCode(FirstWordToken(rowTexts(1)))

        ' 2. Tim UOM (PC / PCS / EA / SET / BOX / CTN / PR / PRS...):
        '    Token ngay truoc UOM la Pack Quantity, token ngay sau UOM la WH
        Dim uomIdx As Long
        uomIdx = 0
        For r = 1 To rowCnt
          If IsUomToken(rowTexts(r)) Then
            uomIdx = r
            Exit For
          End If
        Next r

        If uomIdx > 1 Then
          packQty = ParseDoubleSafe(rowTexts(uomIdx - 1))
          If uomIdx < rowCnt Then
            whCode = NormalizeWhCode(rowTexts(uomIdx + 1))
          End If
        End If

        ' Fallback tim WH o cac token sau UOM neu uomIdx + 1 chua co WH
        If Len(whCode) = 0 And uomIdx > 0 And uomIdx < rowCnt Then
          For r = uomIdx + 1 To rowCnt
            whCode = NormalizeWhCode(rowTexts(r))
            If Len(whCode) > 0 Then Exit For
          Next r
        End If

        ' Fallback theo toa do X neu UOM dac thu
        If packQty <= 0 Or Len(whCode) = 0 Then
          For r = 1 To rowCnt
            If rowXs(r) >= 8200 And rowXs(r) <= 9600 And packQty <= 0 Then
              packQty = ParseDoubleSafe(rowTexts(r))
            ElseIf rowXs(r) >= 10500 And Len(whCode) = 0 Then
              whCode = NormalizeWhCode(rowTexts(r))
            End If
          Next r
        End If

        ' Fallback Quantity neu Pack Quantity chua co
        If packQty <= 0 Then
          For r = 1 To rowCnt
            If rowXs(r) >= 6500 And rowXs(r) <= 8200 Then
              packQty = ParseDoubleSafe(rowTexts(r))
              If packQty > 0 Then Exit For
            End If
          Next r
        End If

        If Len(prodCode) > 0 And packQty > 0 Then
          outDoc.lineCount = outDoc.lineCount + 1
          If outDoc.lineCount > UBound(outDoc.lines) Then
            ReDim Preserve outDoc.lines(1 To outDoc.lineCount + 20)
          End If
          outDoc.lines(outDoc.lineCount).lineNo = tokens(startIdx).text
          outDoc.lines(outDoc.lineCount).productCode = prodCode
          outDoc.lines(outDoc.lineCount).packQty = packQty
          outDoc.lines(outDoc.lineCount).wh = whCode
          outDoc.lines(outDoc.lineCount).used = False

          nHandledY = nHandledY + 1
          ReDim Preserve handledY(1 To nHandledY)
          handledY(nHandledY) = baseY
        End If
      End If
    Next i
  End If

  ' --- LAYER 2: Quet truc tiep ma hang fallback de khong bo sot bat ky ma nao (VD 8836210004) ---
  ' Kiem tra tat ca cac token o cot Product Code (x: 2000-5500).
  ' Neu dong do chua duoc nhat o Layer 1, thu thap dong ngang cua no de lay packQty va WH.
  For i = 1 To tokenCount
    If tokens(i).x >= 2000 And tokens(i).x <= 5500 Then
      Dim itemCand As String
      itemCand = CleanItemCode(FirstWordToken(tokens(i).text))
      If IsProductCodeCandidate(itemCand) Then
        Dim itemBaseY As Double
        itemBaseY = tokens(i).y

        Dim rowHandled As Boolean
        rowHandled = False
        Dim hIdx As Long
        For hIdx = 1 To nHandledY
          If Abs(itemBaseY - handledY(hIdx)) < 140 Then
            rowHandled = True
            Exit For
          End If
        Next hIdx

        If Not rowHandled Then
          Dim altTexts() As String, altXs() As Double, altCnt As Long
          altCnt = 0
          For j = 1 To tokenCount
            If Abs(tokens(j).y - itemBaseY) < 140 Then
              altCnt = altCnt + 1
              ReDim Preserve altTexts(1 To altCnt)
              ReDim Preserve altXs(1 To altCnt)
              altTexts(altCnt) = tokens(j).text
              altXs(altCnt) = tokens(j).x
            End If
          Next j

          If altCnt > 0 Then
            SortTokensByX altTexts, altXs, altCnt

            Dim altPackQty As Double, altWh As String
            altPackQty = 0
            altWh = ""

            Dim altUomIdx As Long
            altUomIdx = 0
            For r = 1 To altCnt
              If IsUomToken(altTexts(r)) Then
                altUomIdx = r
                Exit For
              End If
            Next r

            If altUomIdx > 1 Then
              altPackQty = ParseDoubleSafe(altTexts(altUomIdx - 1))
              If altUomIdx < altCnt Then altWh = NormalizeWhCode(altTexts(altUomIdx + 1))
            End If

            If Len(altWh) = 0 And altUomIdx > 0 And altUomIdx < altCnt Then
              For r = altUomIdx + 1 To altCnt
                altWh = NormalizeWhCode(altTexts(r))
                If Len(altWh) > 0 Then Exit For
              Next r
            End If

            If altPackQty <= 0 Or Len(altWh) = 0 Then
              For r = 1 To altCnt
                If altXs(r) >= 8200 And altXs(r) <= 9600 And altPackQty <= 0 Then
                  altPackQty = ParseDoubleSafe(altTexts(r))
                ElseIf altXs(r) >= 10500 And Len(altWh) = 0 Then
                  altWh = NormalizeWhCode(altTexts(r))
                End If
              Next r
            End If

            If altPackQty <= 0 Then
              For r = 1 To altCnt
                If altXs(r) >= 6500 And altXs(r) <= 8200 Then
                  altPackQty = ParseDoubleSafe(altTexts(r))
                  If altPackQty > 0 Then Exit For
                End If
              Next r
            End If

            If altPackQty > 0 Then
              outDoc.lineCount = outDoc.lineCount + 1
              If outDoc.lineCount > UBound(outDoc.lines) Then
                ReDim Preserve outDoc.lines(1 To outDoc.lineCount + 20)
              End If
              outDoc.lines(outDoc.lineCount).lineNo = "SCAN"
              outDoc.lines(outDoc.lineCount).productCode = itemCand
              outDoc.lines(outDoc.lineCount).packQty = altPackQty
              outDoc.lines(outDoc.lineCount).wh = altWh
              outDoc.lines(outDoc.lineCount).used = False

              nHandledY = nHandledY + 1
              ReDim Preserve handledY(1 To nHandledY)
              handledY(nHandledY) = itemBaseY
            End If
          End If
        End If
      End If
    End If
  Next i
End Sub

' ================= PURE-VBA RFC 1951 INFLATE (ZLIB DECOMPRESSOR) =================
' Giai nen truc tiep FlateDecode stream trong bo nho, khong can thu vien ngoai.

Private Function InflateZlibToLatin1(ByRef src() As Byte, ByVal startPos As Long, ByVal streamLen As Long) As String
  On Error GoTo FailSafe
  Dim pos As Long, endPos As Long
  Dim bitBuf As Long, bitCnt As Long
  Dim pow2(0 To 24) As Long
  Dim lenBase(0 To 28) As Long, lenExtra(0 To 28) As Long
  Dim distBase(0 To 29) As Long, distExtra(0 To 29) As Long
  Dim clOrder(0 To 18) As Long
  Dim i As Long

  pow2(0) = 1
  For i = 1 To 24
    pow2(i) = pow2(i - 1) * 2
  Next i

  FillLongArray lenBase, Array(3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258)
  FillLongArray lenExtra, Array(0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0)
  FillLongArray distBase, Array(1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577)
  FillLongArray distExtra, Array(0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13)
  FillLongArray clOrder, Array(16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15)

  ' Bo qua 2 byte Zlib header (VD: 78 9C)
  pos = startPos + 2
  endPos = startPos + streamLen - 1
  bitBuf = 0
  bitCnt = 0

  Dim outBytes() As Byte, outCap As Long, outLen As Long
  outCap = streamLen * 6
  If outCap < 4096 Then outCap = 4096
  ReDim outBytes(0 To outCap - 1)
  outLen = 0

  Dim litLut(0 To 65535) As Long
  Dim distLut(0 To 65535) As Long
  Dim clLut(0 To 65535) As Long

  Dim bfinal As Long, btype As Long
  bfinal = 0

  Do While bfinal = 0
    bfinal = ReadBits(src, pos, endPos, bitBuf, bitCnt, 1, pow2)
    btype = ReadBits(src, pos, endPos, bitBuf, bitCnt, 2, pow2)

    If btype = 0 Then
      ' Stored block (khong nen)
      bitBuf = 0
      bitCnt = 0
      If pos + 3 > endPos Then Exit Do
      Dim blkLen As Long
      blkLen = CLng(src(pos)) + CLng(src(pos + 1)) * 256&
      pos = pos + 4
      If outLen + blkLen > outCap Then
        outCap = (outLen + blkLen) * 2
        ReDim Preserve outBytes(0 To outCap - 1)
      End If
      For i = 1 To blkLen
        If pos <= endPos Then
          outBytes(outLen) = src(pos)
          outLen = outLen + 1
          pos = pos + 1
        End If
      Next i

    ElseIf btype = 1 Or btype = 2 Then
      If btype = 1 Then
        Dim fixedLit(0 To 287) As Long, fixedDist(0 To 31) As Long
        For i = 0 To 143: fixedLit(i) = 8: Next i
        For i = 144 To 255: fixedLit(i) = 9: Next i
        For i = 256 To 279: fixedLit(i) = 7: Next i
        For i = 280 To 287: fixedLit(i) = 8: Next i
        For i = 0 To 31: fixedDist(i) = 5: Next i
        BuildHuffmanLut fixedLit, 288, pow2, litLut
        BuildHuffmanLut fixedDist, 32, pow2, distLut
      Else
        Dim hlit As Long, hdist As Long, hclen As Long
        hlit = ReadBits(src, pos, endPos, bitBuf, bitCnt, 5, pow2) + 257
        hdist = ReadBits(src, pos, endPos, bitBuf, bitCnt, 5, pow2) + 1
        hclen = ReadBits(src, pos, endPos, bitBuf, bitCnt, 4, pow2) + 4

        Dim clLengths(0 To 18) As Long
        For i = 0 To 18: clLengths(i) = 0: Next i
        For i = 0 To hclen - 1
          clLengths(clOrder(i)) = ReadBits(src, pos, endPos, bitBuf, bitCnt, 3, pow2)
        Next i
        BuildHuffmanLut clLengths, 19, pow2, clLut

        Dim allLengths() As Long, totalSyms As Long, idx As Long
        totalSyms = hlit + hdist
        ReDim allLengths(0 To totalSyms - 1)
        idx = 0
        Do While idx < totalSyms
          Dim cs As Long, rep As Long, prevLen As Long
          cs = DecodeHuffmanSym(src, pos, endPos, bitBuf, bitCnt, pow2, clLut)
          If cs < 0 Then GoTo FailSafe
          If cs < 16 Then
            allLengths(idx) = cs
            idx = idx + 1
          ElseIf cs = 16 Then
            rep = ReadBits(src, pos, endPos, bitBuf, bitCnt, 2, pow2) + 3
            If idx > 0 Then prevLen = allLengths(idx - 1) Else prevLen = 0
            For i = 1 To rep
              If idx < totalSyms Then
                allLengths(idx) = prevLen
                idx = idx + 1
              End If
            Next i
          ElseIf cs = 17 Then
            rep = ReadBits(src, pos, endPos, bitBuf, bitCnt, 3, pow2) + 3
            idx = idx + rep
          ElseIf cs = 18 Then
            rep = ReadBits(src, pos, endPos, bitBuf, bitCnt, 7, pow2) + 11
            idx = idx + rep
          End If
        Loop

        Dim dynLit() As Long, dynDist() As Long
        ReDim dynLit(0 To hlit - 1)
        ReDim dynDist(0 To hdist - 1)
        For i = 0 To hlit - 1: dynLit(i) = allLengths(i): Next i
        For i = 0 To hdist - 1: dynDist(i) = allLengths(hlit + i): Next i
        BuildHuffmanLut dynLit, hlit, pow2, litLut
        BuildHuffmanLut dynDist, hdist, pow2, distLut
      End If

      ' Giai ma luong ky tu & LZ77
      Do
        Dim sym As Long
        sym = DecodeHuffmanSym(src, pos, endPos, bitBuf, bitCnt, pow2, litLut)
        If sym < 0 Then GoTo FailSafe
        If sym < 256 Then
          If outLen >= outCap Then
            outCap = outCap * 2
            ReDim Preserve outBytes(0 To outCap - 1)
          End If
          outBytes(outLen) = CByte(sym)
          outLen = outLen + 1
        ElseIf sym = 256 Then
          Exit Do
        Else
          Dim lIdx As Long, copyLen As Long, dSym As Long, copyDist As Long
          lIdx = sym - 257
          copyLen = lenBase(lIdx) + ReadBits(src, pos, endPos, bitBuf, bitCnt, lenExtra(lIdx), pow2)
          dSym = DecodeHuffmanSym(src, pos, endPos, bitBuf, bitCnt, pow2, distLut)
          If dSym < 0 Then GoTo FailSafe
          copyDist = distBase(dSym) + ReadBits(src, pos, endPos, bitBuf, bitCnt, distExtra(dSym), pow2)

          If outLen + copyLen >= outCap Then
            outCap = (outLen + copyLen) * 2
            ReDim Preserve outBytes(0 To outCap - 1)
          End If
          For i = 1 To copyLen
            outBytes(outLen) = outBytes(outLen - copyDist)
            outLen = outLen + 1
          Next i
        End If
      Loop
    Else
      Exit Do
    End If
  Loop

  If outLen > 0 Then
    InflateZlibToLatin1 = BytesToLatin1String(outBytes, 0, outLen)
  End If
  Exit Function

FailSafe:
  InflateZlibToLatin1 = ""
End Function

Private Function ReadBits( _
  ByRef src() As Byte, _
  ByRef pos As Long, _
  ByVal endPos As Long, _
  ByRef bitBuf As Long, _
  ByRef bitCnt As Long, _
  ByVal n As Long, _
  ByRef pow2() As Long _
) As Long
  If n = 0 Then
    ReadBits = 0
    Exit Function
  End If
  Do While bitCnt < n
    Dim b As Long
    If pos <= endPos Then
      b = CLng(src(pos))
      pos = pos + 1
    Else
      b = 0
    End If
    bitBuf = bitBuf + b * pow2(bitCnt)
    bitCnt = bitCnt + 8
  Loop
  ReadBits = bitBuf Mod pow2(n)
  bitBuf = bitBuf \ pow2(n)
  bitCnt = bitCnt - n
End Function

Private Sub BuildHuffmanLut( _
  ByRef lengths() As Long, _
  ByVal numSyms As Long, _
  ByRef pow2() As Long, _
  ByRef lut() As Long _
)
  Dim blCount(0 To 15) As Long, nextCode(0 To 15) As Long
  Dim i As Long, bits As Long, code As Long, l As Long

  For i = 0 To 65535
    lut(i) = -1
  Next i

  For i = 0 To numSyms - 1
    l = lengths(i)
    If l >= 1 And l <= 15 Then
      blCount(l) = blCount(l) + 1
    End If
  Next i

  code = 0
  blCount(0) = 0
  For bits = 1 To 15
    code = (code + blCount(bits - 1)) * 2
    nextCode(bits) = code
  Next bits

  For i = 0 To numSyms - 1
    l = lengths(i)
    If l >= 1 And l <= 15 Then
      lut(pow2(l) + nextCode(l)) = i
      nextCode(l) = nextCode(l) + 1
    End If
  Next i
End Sub

Private Function DecodeHuffmanSym( _
  ByRef src() As Byte, _
  ByRef pos As Long, _
  ByVal endPos As Long, _
  ByRef bitBuf As Long, _
  ByRef bitCnt As Long, _
  ByRef pow2() As Long, _
  ByRef lut() As Long _
) As Long
  Dim code As Long, l As Long, bitVal As Long, sym As Long
  code = 0
  For l = 1 To 15
    If bitCnt = 0 Then
      If pos <= endPos Then
        bitBuf = CLng(src(pos))
        pos = pos + 1
      Else
        bitBuf = 0
      End If
      bitCnt = 8
    End If
    bitVal = bitBuf Mod 2
    bitBuf = bitBuf \ 2
    bitCnt = bitCnt - 1
    code = code * 2 + bitVal
    sym = lut(pow2(l) + code)
    If sym >= 0 Then
      DecodeHuffmanSym = sym
      Exit Function
    End If
  Next l
  DecodeHuffmanSym = -1
End Function

Private Sub FillLongArray(ByRef target() As Long, ByVal vals As Variant)
  Dim i As Long
  For i = LBound(vals) To UBound(vals)
    target(i - LBound(vals)) = CLng(vals(i))
  Next i
End Sub

' ================= TIEN ICH CHUOI / SHEET / HEADER =================

Private Function BytesToLatin1String(ByRef b() As Byte, ByVal startIdx As Long, ByVal count As Long) As String
  If count <= 0 Then Exit Function
  Dim chars() As Byte, i As Long, srcIdx As Long
  ReDim chars(0 To count * 2 - 1)
  For i = 0 To count - 1
    srcIdx = startIdx + i
    chars(i * 2) = b(srcIdx)
    chars(i * 2 + 1) = 0
  Next i
  BytesToLatin1String = chars
End Function

Private Function ExtractPdfSlashName(ByVal dictStr As String, ByVal key As String) As String
  Dim p As Long, pSlash As Long, i As Long, ch As String, out As String
  p = InStr(1, dictStr, key)
  If p = 0 Then Exit Function
  pSlash = InStr(p + Len(key), dictStr, "/")
  If pSlash = 0 Then Exit Function
  For i = pSlash + 1 To Len(dictStr)
    ch = Mid$(dictStr, i, 1)
    If ch = " " Or ch = vbCr Or ch = vbLf Or ch = "/" Or ch = ">" Or ch = "[" Or ch = "<" Then Exit For
    out = out & ch
  Next i
  ExtractPdfSlashName = out
End Function

Private Function ExtractPdfObjRef(ByVal dictStr As String, ByVal key As String) As Long
  Dim p As Long, i As Long, ch As String, numStr As String
  p = InStr(1, dictStr, key)
  If p = 0 Then Exit Function
  For i = p + Len(key) To Len(dictStr)
    ch = Mid$(dictStr, i, 1)
    If ch >= "0" And ch <= "9" Then
      numStr = numStr & ch
    ElseIf Len(numStr) > 0 Then
      Exit For
    End If
  Next i
  ExtractPdfObjRef = Val(numStr)
End Function

Private Function IsLineNoToken(ByVal s As String) As Boolean
  Dim t As String, i As Long, ch As String
  t = Trim$(s)
  If Len(t) = 0 Or Len(t) > 6 Then Exit Function
  For i = 1 To Len(t)
    ch = Mid$(t, i, 1)
    If ch < "0" Or ch > "9" Then Exit Function
  Next i
  If Val(t) > 0 Then IsLineNoToken = True
End Function

Private Function IsSixDigitLineNo(ByVal s As String) As Boolean
  IsSixDigitLineNo = IsLineNoToken(s)
End Function

Private Sub SortTokensByX(ByRef texts() As String, ByRef xs() As Double, ByVal n As Long)
  Dim i As Long, j As Long, tmpX As Double, tmpT As String
  If n <= 1 Then Exit Sub
  For i = 1 To n - 1
    For j = i + 1 To n
      If xs(j) < xs(i) Then
        tmpX = xs(i): xs(i) = xs(j): xs(j) = tmpX
        tmpT = texts(i): texts(i) = texts(j): texts(j) = tmpT
      End If
    Next j
  Next i
End Sub

Private Function IsUomToken(ByVal s As String) As Boolean
  Dim u As String
  u = UCase$(Trim$(s))
  Select Case u
    Case "PC", "PCS", "EA", "SET", "SETS", "BOX", "BOXES", "CTN", "CTNS", _
         "PR", "PRS", "BAG", "BAGS", "ROLL", "ROLLS", "M", "KG", "UNT", _
         "UNIT", "UNITS", "PAC", "PACK", "PACKS", "TH", "LOT"
      IsUomToken = True
    Case Else
      IsUomToken = False
  End Select
End Function

Private Function IsProductCodeCandidate(ByVal s As String) As Boolean
  Dim t As String, i As Long, ch As String, hasDigit As Boolean, hasAlpha As Boolean
  t = UCase$(Trim$(s))
  If Len(t) < 5 Or Len(t) > 35 Then Exit Function
  Select Case t
    Case "PAGE", "TOTAL", "SUBTOTAL", "DATE", "ORDER", "ORDERS", "SALES", _
         "ITEM", "ITEMS", "MATERIAL", "DESCRIPTION", "QUANTITY", "PACK", _
         "LOCATION", "STORAGE", "PLANT", "KHO", "WAREHOUSE", "SHIP", _
         "FROM", "TO", "SOLD", "DELIVERY", "INVOICE", "PACKING", "LIST", _
         "CARTON", "NET", "GROSS", "WEIGHT", "VOLUME", "REMARK", "REMARKS"
      Exit Function
  End Select
  For i = 1 To Len(t)
    ch = Mid$(t, i, 1)
    If ch >= "0" And ch <= "9" Then
      hasDigit = True
    ElseIf ch >= "A" And ch <= "Z" Then
      hasAlpha = True
    End If
  Next i
  If hasDigit Or (hasAlpha And Len(t) >= 6) Then
    IsProductCodeCandidate = True
  End If
End Function

Private Function CleanItemCode(ByVal v As Variant) As String
  If IsError(v) Then Exit Function
  If IsEmpty(v) Or IsNull(v) Then Exit Function
  Dim s As String, i As Long, ch As String, out As String
  s = CStr(v)
  s = Replace(s, Chr(160), "")
  s = Replace(s, ChrW(160), "")
  s = Trim$(s)
  If InStr(1, s, ".") > 0 Then
    Dim dVal As Double
    dVal = Val(s)
    If dVal = Int(dVal) And dVal > 0 Then
      CleanItemCode = Trim$(Str$(dVal))
      If Left$(CleanItemCode, 1) = " " Then CleanItemCode = Mid$(CleanItemCode, 2)
      Exit Function
    End If
  End If
  For i = 1 To Len(s)
    ch = Mid$(s, i, 1)
    If ch > " " And ch <> vbTab And ch <> vbCr And ch <> vbLf Then
      out = out & ch
    End If
  Next i
  CleanItemCode = UCase$(out)
End Function

Private Function FirstWordToken(ByVal s As String) As String
  Dim t As String, sp As Long
  t = Trim$(s)
  sp = InStr(1, t, " ")
  If sp > 0 Then
    FirstWordToken = Left$(t, sp - 1)
  Else
    FirstWordToken = t
  End If
End Function

Private Function NormalizeWhCode(ByVal rawWh As String) As String
  Dim s As String, i As Long, ch As String, clean As String
  s = Trim$(rawWh)
  If Len(s) = 0 Then Exit Function
  If LCase$(Left$(s, 4)) = "kho " Then
    s = Trim$(Mid$(s, 5))
  ElseIf LCase$(Left$(s, 3)) = "wh " Then
    s = Trim$(Mid$(s, 4))
  End If
  For i = 1 To Len(s)
    ch = Mid$(s, i, 1)
    If (ch >= "0" And ch <= "9") Or (ch >= "A" And ch <= "Z") Or (ch >= "a" And ch <= "z") Then
      clean = clean & ch
    End If
  Next i
  If Len(clean) = 1 And (clean >= "1" And clean <= "9") Then
    NormalizeWhCode = "0" & clean
  Else
    NormalizeWhCode = clean
  End If
End Function

Private Function ParseDoubleSafe(ByVal v As Variant) As Double
  If IsError(v) Then Exit Function
  If IsEmpty(v) Or IsNull(v) Then Exit Function
  If IsNumeric(v) And VarType(v) <> vbString Then
    ParseDoubleSafe = CDbl(v)
    Exit Function
  End If
  Dim s As String, i As Long, ch As String, clean As String
  s = Trim$(CStr(v))
  If Len(s) = 0 Then Exit Function
  For i = 1 To Len(s)
    ch = Mid$(s, i, 1)
    If (ch >= "0" And ch <= "9") Or ch = "." Or ch = "-" Then
      clean = clean & ch
    End If
  Next i
  If Len(clean) > 0 Then
    ParseDoubleSafe = Val(clean)
  End If
End Function

Private Function ExtractLongestDigitRun(ByVal s As String) As String
  Dim i As Long, ch As String, cur As String, best As String
  For i = 1 To Len(s)
    ch = Mid$(s, i, 1)
    If ch >= "0" And ch <= "9" Then
      cur = cur & ch
    Else
      If Len(cur) > Len(best) Then best = cur
      cur = ""
    End If
  Next i
  If Len(cur) > Len(best) Then best = cur
  ExtractLongestDigitRun = best
End Function

Private Function FormatNumberClean(ByVal d As Double) As String
  Dim s As String
  If d = Int(d) Then
    FormatNumberClean = Trim$(Str$(CLng(d)))
  Else
    s = Replace(Trim$(Str$(Round(d, 2))), ",", ".")
    If Left$(s, 1) = "." Then s = "0" & s
    FormatNumberClean = s
  End If
End Function

Private Function IsAlphaNumChar(ByVal ch As String) As Boolean
  If (ch >= "0" And ch <= "9") Or (ch >= "A" And ch <= "Z") Or (ch >= "a" And ch <= "z") Then
    IsAlphaNumChar = True
  End If
End Function

Private Function GetFileNameOnly(ByVal fullPath As String) As String
  Dim p As Long
  p = InStrRev(fullPath, "\")
  If p = 0 Then p = InStrRev(fullPath, "/")
  If p > 0 Then
    GetFileNameOnly = Mid$(fullPath, p + 1)
  Else
    GetFileNameOnly = fullPath
  End If
End Function

Private Function SanitizeFileName(ByVal name As String) As String
  Dim out As String, i As Long, ch As String
  For i = 1 To Len(name)
    ch = Mid$(name, i, 1)
    Select Case ch
      Case "\", "/", ":", "*", "?", """", "<", ">", "|"
        out = out & "_"
      Case Else
        out = out & ch
    End Select
  Next i
  SanitizeFileName = out
End Function

Private Function JoinDictKeys(ByVal d As Object, ByVal sep As String, ByVal maxItems As Long) As String
  Dim k As Variant, cnt As Long, out As String
  For Each k In d.Keys
    cnt = cnt + 1
    If cnt > maxItems Then
      out = out & sep & "..."
      Exit For
    End If
    If Len(out) > 0 Then out = out & sep
    out = out & CStr(k)
  Next k
  JoinDictKeys = out
End Function

Private Function ResolveTargetSheet(ByVal preferredName As String) As Worksheet
  Dim ws As Worksheet
  On Error Resume Next
  Set ws = ThisWorkbook.Worksheets(preferredName)
  On Error GoTo 0
  If ws Is Nothing Then
    Set ws = ActiveSheet
  End If
  Set ResolveTargetSheet = ws
End Function

Private Function GetHeaderRowArray(ByVal arr As Variant) As Variant
  Dim n As Long, j As Long, out() As String
  n = UBound(arr, 2)
  ReDim out(1 To n)
  For j = 1 To n
    out(j) = CStr(arr(1, j) & "")
  Next j
  GetHeaderRowArray = out
End Function

Private Function FindHeaderCol(ByVal headers As Variant, ByVal aliases As Variant) As Long
  Dim j As Long, k As Long, h As String
  For j = LBound(headers) To UBound(headers)
    h = NormHeaderStr(headers(j))
    If Len(h) > 0 Then
      For k = LBound(aliases) To UBound(aliases)
        If h = aliases(k) Then
          FindHeaderCol = j
          Exit Function
        End If
      Next k
    End If
  Next j
  FindHeaderCol = 0
End Function

Private Function FindWhHeaderFallback(ByVal headers As Variant) As Long
  Dim j As Long, h As String
  For j = LBound(headers) To UBound(headers)
    h = NormHeaderStr(headers(j))
    If Len(h) > 0 Then
      If InStr(1, h, "khoxuat") > 0 Or InStr(1, h, "warehouse") > 0 Or Left$(h, 2) = "wh" Then
        FindWhHeaderFallback = j
        Exit Function
      End If
    End If
  Next j
  FindWhHeaderFallback = 0
End Function

Private Function NormHeaderStr(ByVal v As Variant) As String
  Dim t As String, i As Long, out As String, ch As String
  t = LCase$(Trim$(CStr(v & "")))
  t = StripVietnameseTones(t)
  For i = 1 To Len(t)
    ch = Mid$(t, i, 1)
    If (ch >= "a" And ch <= "z") Or (ch >= "0" And ch <= "9") Then
      out = out & ch
    End If
  Next i
  NormHeaderStr = out
End Function

Private Function StripVietnameseTones(ByVal s As String) As String
  Dim res As String
  res = s
  res = ReplaceCharCodes(res, Array(224, 225, 7843, 227, 7841, 259, 7855, 7857, 7859, 7861, 7863, 226, 7845, 7847, 7849, 7851, 7853), "a")
  res = ReplaceCharCodes(res, Array(232, 233, 7867, 7869, 7865, 234, 7871, 7873, 7875, 7877, 7879), "e")
  res = ReplaceCharCodes(res, Array(236, 237, 7881, 297, 7883), "i")
  res = ReplaceCharCodes(res, Array(242, 243, 7887, 245, 7885, 244, 7889, 7891, 7893, 7895, 7897, 417, 7899, 7901, 7903, 7905, 7907), "o")
  res = ReplaceCharCodes(res, Array(249, 250, 7911, 361, 7909, 432, 7913, 7915, 7917, 7919, 7921), "u")
  res = ReplaceCharCodes(res, Array(7923, 253, 7927, 7929, 7925), "y")
  res = ReplaceCharCodes(res, Array(273), "d")
  StripVietnameseTones = res
End Function

Private Function ReplaceCharCodes(ByVal s As String, ByVal codes As Variant, ByVal replacement As String) As String
  Dim res As String, i As Long
  res = s
  For i = LBound(codes) To UBound(codes)
    res = Replace(res, ChrW(codes(i)), replacement)
  Next i
  ReplaceCharCodes = res
End Function
