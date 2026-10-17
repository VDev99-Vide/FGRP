Attribute VB_Name = "FGRP_API"
' ============================================================
' FGRP API - Day du lieu len Supabase bang 1 nut bam (One-click)
' ============================================================
' Cach dung:
'   1. Mo Excel -> Alt+F11 -> File > Import File... -> chon FGRP_API.bas
'   2. Sua 3 hang CONFIG ben duoi cho dung (URL, ANON_KEY, TOKEN)
'   3. Tao nut bam tren sheet: Developer > Insert > Button -> gan macro
'      NHOM LAY DU LIEU TU FILE NGUON (Stock Balance With Batch):
'      - FGRP_LayDuLieuNhapKho      : chon file nguon -> loc -> ghi sheet TON_KHO
'      - FGRP_LayDuLieuCapNhatNguon : chon file nguon -> loc -> ghi sheet MASTER_DATA
'      NHOM DAY LEN DATABASE:
'      - FGRP_DayTonKho            : day Ton Kho Thanh Pham (thay the toan bo)
'      - FGRP_DayTonKhoThuNghiem   : thu nghiem, KHONG ghi du lieu
'      - FGRP_DayCapNhatNguon      : day Cap Nhat Nguon (thay the toan bo)
'      - FGRP_DayCapNhatNguonThuNghiem : thu nghiem, KHONG ghi du lieu
'      - FGRP_DayKeHoachXuatHang   : day Ke Hoach Xuat Hang (cong don)
'      - FGRP_DayKeHoachThuNghiem  : thu nghiem, KHONG ghi du lieu
'      - FGRP_TestKetNoi           : kiem tra ket noi + xem so dong tren DB
'
' Quy tac loc tu file nguon (sheet dau tien, dong 1 = tieu de):
'   - Cot A = Stock Code: chi lay dong bat dau bang "8" hoac "1220"
'   - NHAP KHO: them dieu kien cot B (Warehouse) = "01" hoac "60"
'     (tu chuan hoa: o dang so 1 -> "01"); lay D = BATCH -> Tag ID, E = BIN
'   - CAP NHAT NGUON: lay cot A,B,C,D,F (A=Stock Code, B=Warehouse,
'     C=CREATEDATE, D=BATCH, F=Qty); BO QUA cot E (BIN)
'
' Luu y:
'   - Cot duoc tu dong nhan dien theo tieu de (Tag ID / Ma kien, Bin / Vi tri;
'     PO, SO, Container, Item Code / Ma hang, Loading date, Qty, Pkg).
'   - Du lieu gui duoi dang JSON thuan ASCII (ky tu tieng Viet duoc escape
'     \uXXXX) nen khong bi loi font/encoding khi truyen qua HTTPS.
'   - Ton kho: server se TU CHOI neu file co cung Tag ID + Bin lap lai.
'   - Ton kho + Nguon: THAY THE toan bo => chi gui 1 request duy nhat.
'   - Ke hoach xuat hang: CONG DON (khong xoa du lieu cu), chia chunk 1000.
' ============================================================
Option Explicit

' ======================= CONFIG =======================
Private Const FGRP_URL As String = "https://dhlpkycpkndfdgnbdcwn.supabase.co"
Private Const FGRP_ANON_KEY As String = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRobHBreWNwa25kZmRnbmJkY3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwODM2NDgsImV4cCI6MjA5NTY1OTY0OH0.aVbFpwZj6_zYlTqHYds27f9Q7brZn8Ti-0VUOFRuslE"
' Token duoc sinh tu database/api_vba.sql (bang public.app_config, key = import_token)
Private Const FGRP_TOKEN As String = "c20695cbfa064b3c98f6c376ff97f4d62d99bc5b"

' Ten sheet chua du lieu (neu khong tim thay se dung sheet dang mo)
Private Const SHEET_TON_KHO As String = "TON_KHO"
Private Const SHEET_MASTER As String = "MASTER_DATA"
Private Const SHEET_KE_HOACH As String = "KE_HOACH_XUAT_HANG"

' File nguon "Stock Balance With Batch" (sheet dau tien, dong 1 = tieu de):
'   A=Stock Code | B=Warehouse | C=CREATEDATE | D=BATCH | E=BIN (chi cho NHAP KHO) | F=Qty
Private Const SRC_COL_STOCK As Long = 1
Private Const SRC_COL_WAREHOUSE As Long = 2
Private Const SRC_COL_CREATEDATE As Long = 3
Private Const SRC_COL_BATCH As Long = 4
Private Const SRC_COL_BIN As Long = 5
Private Const SRC_COL_QTY As Long = 6

' So dong moi request cho KE HOACH XUAT HANG (cong don - chia chunk AN TOAN).
' LUU Y: TON KHO la REPLACE toan bo nen PHAI gui 1 request duy nhat, khong chia chunk!
Private Const CHUNK_SIZE As Long = 1000
' ======================================================

' ================= PUBLIC MACROS =================

Public Sub FGRP_TestKetNoi()
  On Error GoTo Fail
  Dim resp As String
  resp = HttpPostRpc("api_healthcheck", "{""p_token"":""" & JsonEscape(FGRP_TOKEN) & """}")
  MsgBox "Ket noi thanh cong!" & vbCrLf & vbCrLf & resp, vbInformation, "FGRP API"
  Exit Sub
Fail:
  MsgBox "Ket noi that bai:" & vbCrLf & Err.Description, vbCritical, "FGRP API"
End Sub

Public Sub FGRP_DayTonKho()
  PushTonKho False
End Sub

Public Sub FGRP_DayTonKhoThuNghiem()
  PushTonKho True
End Sub

Public Sub FGRP_DayKeHoachXuatHang()
  PushKeHoach False
End Sub

Public Sub FGRP_DayKeHoachThuNghiem()
  PushKeHoach True
End Sub

Public Sub FGRP_LayDuLieuNhapKho()
  LayDuLieuTuFileNguon True
End Sub

Public Sub FGRP_LayDuLieuCapNhatNguon()
  LayDuLieuTuFileNguon False
End Sub

Public Sub FGRP_DayCapNhatNguon()
  PushMasterData False
End Sub

Public Sub FGRP_DayCapNhatNguonThuNghiem()
  PushMasterData True
End Sub

' ================= TON KHO =================

Private Sub PushTonKho(ByVal dryRun As Boolean)
  Dim ws As Worksheet, arr As Variant
  Dim headers As Variant
  Dim colTag As Long, colBin As Long
  Dim nRows As Long, i As Long
  Dim buf As String, bufCount As Long
  Dim totalRead As Long, serverCount As Long
  Dim modeText As String

  On Error GoTo Fail

  Set ws = ResolveSheet(SHEET_TON_KHO)
  arr = ws.UsedRange.Value2
  If Not IsArray(arr) Then
    MsgBox "Sheet '" & ws.Name & "' dang trong, khong co du lieu.", vbExclamation, "FGRP API"
    Exit Sub
  End If

  headers = HeaderRowArray(arr)
  colTag = FindCol(headers, Array("tagid", "tag", "batch", "barcode", "code", "makien", "malot", "lot", "solo", "serial"))
  colBin = FindCol(headers, Array("bin", "vitri", "location", "kho", "warehouse", "okho", "vitrikho", "wh"))

  If colTag = 0 Then
    MsgBox "Khong tim thay cot 'Tag ID' (hoac 'Ma kien', 'Batch'...) trong sheet '" & ws.Name & "'." & vbCrLf & _
           "Dong tieu de phai nam o dong 1.", vbCritical, "FGRP API"
    Exit Sub
  End If

  nRows = UBound(arr, 1)
  If nRows < 2 Then
    MsgBox "Sheet '" & ws.Name & "' chi co dong tieu de, khong co du lieu.", vbExclamation, "FGRP API"
    Exit Sub
  End If

  buf = ""
  bufCount = 0
  totalRead = 0
  serverCount = 0

  For i = 2 To nRows
    Dim tag As String
    tag = Trim$(CStr(arr(i, colTag) & ""))
    If Len(tag) > 0 Then
      Dim bin As String
      bin = ""
      If colBin > 0 Then bin = Trim$(CStr(arr(i, colBin) & ""))
      If bufCount > 0 Then buf = buf & ","
      buf = buf & "{""tag_id"":""" & JsonEscape(tag) & """,""bin"":""" & JsonEscape(bin) & """}"
      bufCount = bufCount + 1
      totalRead = totalRead + 1
    End If
    If (i Mod 500) = 0 Then
      Application.StatusBar = "FGRP: dang doc " & i & "/" & nRows & " dong..."
    End If
  Next i

  ' REPLACE toan bo: chi 1 request duy nhat (chia chunk se mat du lieu - chi con chunk cuoi)
  If bufCount > 0 Then
    Application.StatusBar = "FGRP: dang gui " & totalRead & " dong len server (1 request)..."
    serverCount = SendInventoryPayload(buf, dryRun)
  End If

  Application.StatusBar = False
  modeText = IIf(dryRun, "THU NGHIEM (khong ghi du lieu)", "DA GHI VAO DATABASE")
  MsgBox "TON KHO THANH PHAM - " & modeText & vbCrLf & vbCrLf & _
         "Doc tu sheet: " & ws.Name & vbCrLf & _
         "So dong hop le gui len: " & totalRead & vbCrLf & _
         "Server xac nhan: " & serverCount & vbCrLf & vbCrLf & _
         "Luu y: du lieu TON KHO moi THAY THE toan bo du lieu cu.", vbInformation, "FGRP API"
  Exit Sub

Fail:
  Application.StatusBar = False
  MsgBox "Loi day Ton Kho:" & vbCrLf & Err.Description, vbCritical, "FGRP API"
End Sub

' TON KHO = REPLACE toan bo: PHAI gui 1 request duy nhat.
' Neu chia nhieu request, moi request se xoa het du lieu cu roi chi chen phan cua no
' => DB chi con lai chunk cuoi cung (mat du lieu). Da kiem chung payload 5.016 dong
' (~188KB) gui 1 lan chi mat ~1 giay tren DB that.
Private Function SendInventoryPayload(ByVal rowsJson As String, ByVal dryRun As Boolean) As Long
  Dim body As String, resp As String
  body = "{""p_token"":""" & JsonEscape(FGRP_TOKEN) & """," & _
         """payload"":[" & rowsJson & "]," & _
         """p_dry_run"":" & IIf(dryRun, "true", "false") & "}"
  resp = HttpPostRpc("api_replace_inventory", body)
  SendInventoryPayload = Val(Trim$(resp))
End Function

' ================= KE HOACH XUAT HANG =================

Private Sub PushKeHoach(ByVal dryRun As Boolean)
  Dim ws As Worksheet, arr As Variant
  Dim headers As Variant
  Dim colPo As Long, colSo As Long, colCont As Long, colItem As Long
  Dim colDate As Long, colQty As Long, colPcs As Long, colPkg As Long
  Dim nRows As Long, i As Long
  Dim buf As String, bufCount As Long
  Dim totalRead As Long, serverCount As Long
  Dim modeText As String

  On Error GoTo Fail

  Set ws = ResolveSheet(SHEET_KE_HOACH)
  arr = ws.UsedRange.Value2
  If Not IsArray(arr) Then
    MsgBox "Sheet '" & ws.Name & "' dang trong, khong co du lieu.", vbExclamation, "FGRP API"
    Exit Sub
  End If

  headers = HeaderRowArray(arr)
  colPo = FindCol(headers, Array("po", "ponumber", "sopo", "donhang", "purchaseorder"))
  colSo = FindCol(headers, Array("so", "sonumber", "salesorder", "donhangban", "soso"))
  colCont = FindCol(headers, Array("container", "containerno", "cont", "socontainer"))
  colItem = FindCol(headers, Array("itemcode", "lpvnitemcode", "lpvn", "item", "mahang", "stockcode", "lpno", "masanpham", "productcode"))
  colDate = FindCol(headers, Array("loadingdate", "ngayxuat", "ngaygiao", "etd", "dateship", "ngaydi", "ngayloading", "ngayxuat hang"))
  colQty = FindCol(headers, Array("qty", "quantity", "soluong", "sl", "pcs"))
  colPcs = FindCol(headers, Array("pcsperpkg", "pcspkg", "pcsperbox", "pcspercarton"))
  colPkg = FindCol(headers, Array("pkg", "carton", "thung", "sokien", "kien", "box"))

  If colItem = 0 Then
    MsgBox "Khong tim thay cot 'Item Code' (hoac 'Ma hang', 'LP.No', 'Stock Code'...) trong sheet '" & ws.Name & "'." & vbCrLf & _
           "Dong tieu de phai nam o dong 1.", vbCritical, "FGRP API"
    Exit Sub
  End If

  nRows = UBound(arr, 1)
  If nRows < 2 Then
    MsgBox "Sheet '" & ws.Name & "' chi co dong tieu de, khong co du lieu.", vbExclamation, "FGRP API"
    Exit Sub
  End If

  buf = ""
  bufCount = 0
  totalRead = 0
  serverCount = 0

  For i = 2 To nRows
    Dim item As String
    item = Trim$(CStr(arr(i, colItem) & ""))
    If Len(item) > 0 Then
      Dim po As String, so As String, cont As String
      po = "": so = "": cont = ""
      If colPo > 0 Then po = Trim$(CStr(arr(i, colPo) & ""))
      If colSo > 0 Then so = Trim$(CStr(arr(i, colSo) & ""))
      If colCont > 0 Then cont = Trim$(CStr(arr(i, colCont) & ""))

      Dim dateVal As Variant, qtyVal As Variant, pcsVal As Variant, pkgVal As Variant
      dateVal = Empty: qtyVal = Empty: pcsVal = Empty: pkgVal = Empty
      If colDate > 0 Then dateVal = arr(i, colDate)
      If colQty > 0 Then qtyVal = arr(i, colQty)
      If colPcs > 0 Then pcsVal = arr(i, colPcs)
      If colPkg > 0 Then pkgVal = arr(i, colPkg)

      If bufCount > 0 Then buf = buf & ","
      buf = buf & "{""po"":""" & JsonEscape(po) & """," & _
            """so"":""" & JsonEscape(so) & """," & _
            """container_no"":""" & JsonEscape(cont) & """," & _
            """item_code"":""" & JsonEscape(item) & """," & _
            """loading_date"":""" & JsonEscape(DateToDdMmVy(dateVal)) & """," & _
            """qty"":" & NumToJson(qtyVal) & "," & _
            """pcs_per_pkg"":" & NumToJson(pcsVal) & "," & _
            """pkg"":" & NumToJson(pkgVal) & "}"
      bufCount = bufCount + 1
      totalRead = totalRead + 1
      If bufCount >= CHUNK_SIZE Then
        serverCount = serverCount + SendForecastChunk(buf, totalRead, dryRun)
        buf = ""
        bufCount = 0
      End If
    End If
    If (i Mod 500) = 0 Then
      Application.StatusBar = "FGRP: dang doc " & i & "/" & nRows & " dong..."
    End If
  Next i
  If bufCount > 0 Then
    serverCount = serverCount + SendForecastChunk(buf, totalRead, dryRun)
  End If

  Application.StatusBar = False
  modeText = IIf(dryRun, "THU NGHIEM (khong ghi du lieu)", "DA GHI VAO DATABASE (cong don)")
  MsgBox "KE HOACH XUAT HANG - " & modeText & vbCrLf & vbCrLf & _
         "Doc tu sheet: " & ws.Name & vbCrLf & _
         "So dong hop le gui len: " & totalRead & vbCrLf & _
         "Server xac nhan: " & serverCount & vbCrLf & vbCrLf & _
         "Luu y: ke hoach xuat hang duoc CONG DON, khong xoa du lieu cu.", vbInformation, "FGRP API"
  Exit Sub

Fail:
  Application.StatusBar = False
  MsgBox "Loi day Ke Hoach Xuat Hang:" & vbCrLf & Err.Description, vbCritical, "FGRP API"
End Sub

Private Function SendForecastChunk(ByVal rowsJson As String, ByVal totalSoFar As Long, ByVal dryRun As Boolean) As Long
  Dim body As String, resp As String
  body = "{""p_token"":""" & JsonEscape(FGRP_TOKEN) & """," & _
         """payload"":[" & rowsJson & "]," & _
         """p_mode"":""append""," & _
         """p_dry_run"":" & IIf(dryRun, "true", "false") & "}"
  resp = HttpPostRpc("api_import_shipping_forecast", body)
  SendForecastChunk = Val(Trim$(resp))
  Application.StatusBar = "FGRP: da gui " & totalSoFar & " dong len server..."
End Function

' ================= CAP NHAT NGUON (MASTER DATA) =================

Private Sub PushMasterData(ByVal dryRun As Boolean)
  Dim ws As Worksheet, arr As Variant
  Dim headers As Variant
  Dim colBatch As Long, colStock As Long, colQty As Long, colWh As Long, colDate As Long
  Dim nRows As Long, i As Long
  Dim buf As String, totalRead As Long, boQua As Long, serverCount As Long
  Dim modeText As String

  On Error GoTo Fail

  Set ws = ResolveSheet(SHEET_MASTER)
  arr = ws.UsedRange.Value2
  If Not IsArray(arr) Then
    MsgBox "Sheet '" & ws.Name & "' dang trong, khong co du lieu.", vbExclamation, "FGRP API"
    Exit Sub
  End If

  headers = HeaderRowArray(arr)
  colBatch = FindCol(headers, Array("batch", "tagid", "tag", "makien", "malo", "lot", "solo", "barcode", "code", "batchno", "malot"))
  colStock = FindCol(headers, Array("stockcode", "lpno", "itemcode", "productcode", "mahang", "masanpham", "partno", "itemno", "material", "stock"))
  colQty = FindCol(headers, Array("qty", "quantity", "soluong", "sl", "pcs", "count"))
  colWh = FindCol(headers, Array("warehouse", "wh", "kho", "whlocation", "makho", "whse", "location"))
  colDate = FindCol(headers, Array("createdate", "date", "ngaytao", "ngaynhap", "creationdate"))

  If colBatch = 0 Or colStock = 0 Then
    MsgBox "Khong tim thay cot 'BATCH' va/hoac 'Stock Code' trong sheet '" & ws.Name & "'." & vbCrLf & _
           "Dong tieu de phai nam o dong 1.", vbCritical, "FGRP API"
    Exit Sub
  End If

  nRows = UBound(arr, 1)
  If nRows < 2 Then
    MsgBox "Sheet '" & ws.Name & "' chi co dong tieu de, khong co du lieu.", vbExclamation, "FGRP API"
    Exit Sub
  End If

  buf = ""
  totalRead = 0
  boQua = 0
  serverCount = 0

  For i = 2 To nRows
    Dim bt As String, sc As String
    bt = Trim$(CStr(arr(i, colBatch) & ""))
    sc = Trim$(CStr(arr(i, colStock) & ""))
    If Len(bt) = 0 Or Len(sc) = 0 Then
      boQua = boQua + 1
    Else
      Dim qv As Variant, wv As String, dv As String
      qv = Empty
      wv = ""
      dv = ""
      If colQty > 0 Then qv = arr(i, colQty)
      If colWh > 0 Then wv = Trim$(CStr(arr(i, colWh) & ""))
      If colDate > 0 Then dv = DateToDdMmVy(arr(i, colDate))

      If totalRead > 0 Then buf = buf & ","
      buf = buf & "{""batch"":""" & JsonEscape(bt) & """," & _
            """stock_code"":""" & JsonEscape(sc) & """," & _
            """qty"":" & NumToJson(qv) & "," & _
            """warehouse"":""" & JsonEscape(wv) & """," & _
            """create_date"":""" & JsonEscape(dv) & """}"
      totalRead = totalRead + 1
    End If
    If (i Mod 500) = 0 Then
      Application.StatusBar = "FGRP: dang doc " & i & "/" & nRows & " dong..."
    End If
  Next i

  ' REPLACE toan bo: chi 1 request duy nhat (chia chunk se mat du lieu)
  If totalRead > 0 Then
    Application.StatusBar = "FGRP: dang gui " & totalRead & " dong len server (1 request)..."
    serverCount = SendMasterPayload(buf, dryRun)
  End If

  Application.StatusBar = False
  modeText = IIf(dryRun, "THU NGHIEM (khong ghi du lieu)", "DA GHI VAO DATABASE")
  MsgBox "CAP NHAT NGUON (MASTER DATA) - " & modeText & vbCrLf & vbCrLf & _
         "Doc tu sheet: " & ws.Name & vbCrLf & _
         "So dong hop le gui len: " & totalRead & vbCrLf & _
         "Bo qua (thieu BATCH/Stock Code): " & boQua & vbCrLf & _
         "Server xac nhan: " & serverCount & vbCrLf & vbCrLf & _
         "Luu y: du lieu NGUON moi THAY THE toan bo du lieu cu.", vbInformation, "FGRP API"
  Exit Sub

Fail:
  Application.StatusBar = False
  MsgBox "Loi day Cap Nhat Nguon:" & vbCrLf & Err.Description, vbCritical, "FGRP API"
End Sub

' MASTER DATA = REPLACE toan bo: PHAI gui 1 request duy nhat.
Private Function SendMasterPayload(ByVal rowsJson As String, ByVal dryRun As Boolean) As Long
  Dim body As String, resp As String
  body = "{""p_token"":""" & JsonEscape(FGRP_TOKEN) & """," & _
         """payload"":[" & rowsJson & "]," & _
         """p_dry_run"":" & IIf(dryRun, "true", "false") & "}"
  resp = HttpPostRpc("api_replace_master_data", body)
  SendMasterPayload = Val(Trim$(resp))
End Function

' ================= LAY DU LIEU TU FILE NGUON =================
' File nguon "Stock Balance With Batch" (sheet dau tien, dong 1 = tieu de):
'   A=Stock Code | B=Warehouse | C=CREATEDATE | D=BATCH | E=BIN | F=Qty
'   - NHAP KHO (choNhapKho=True) : loc cot A starts 8/1220 VA cot B = 01/60
'     -> ghi sheet TON_KHO: (D) Tag ID + (E) Bin
'   - CAP NHAT NGUON (choNhapKho=False): chi loc cot A starts 8/1220
'     -> ghi sheet MASTER_DATA: A,B,C,D,F (bo qua E - BIN)

Private Sub LayDuLieuTuFileNguon(ByVal choNhapKho As Boolean)
  Dim path As String, sheetNguon As String, srcArr As Variant
  Dim nRows As Long, i As Long, k As Long, boQua As Long
  Dim maxCol As Long, outArr() As Variant
  Dim ws As Worksheet, msg As String

  On Error GoTo Fail

  path = ChonFileNguon()
  If Len(path) = 0 Then Exit Sub

  srcArr = ReadFirstSheetArr(path, sheetNguon)
  If Not IsArray(srcArr) Then
    MsgBox "File nguon khong co du lieu." & vbCrLf & path, vbExclamation, "FGRP API"
    Exit Sub
  End If

  nRows = UBound(srcArr, 1)
  maxCol = UBound(srcArr, 2)
  If nRows < 2 Then
    MsgBox "File nguon chi co dong tieu de, khong co du lieu.", vbExclamation, "FGRP API"
    Exit Sub
  End If
  If choNhapKho And maxCol < SRC_COL_BIN Then
    MsgBox "File nguon thieu cot E (BIN) - can den cot E.", vbCritical, "FGRP API"
    Exit Sub
  End If
  If (Not choNhapKho) And maxCol < SRC_COL_QTY Then
    MsgBox "File nguon thieu cot F (Qty) - can den cot F.", vbCritical, "FGRP API"
    Exit Sub
  End If

  If choNhapKho Then
    ' ===== LOC KIEU NHAP KHO: A starts 8/1220 VA B = 01/60 -> (D, E) =====
    Dim arrTag() As String, arrBin() As String
    Dim seen As Object, keyStr As String
    Dim dupGroups As Long, dupRows As Long, dupViDu As String
    Dim it As Variant

    ReDim arrTag(1 To nRows)
    ReDim arrBin(1 To nRows)
    Set seen = CreateObject("Scripting.Dictionary")

    For i = 2 To nRows
      If IsMaNguonHopLe(srcArr(i, SRC_COL_STOCK)) Then
        Dim wh As String
        wh = NormalizeWh(srcArr(i, SRC_COL_WAREHOUSE))
        If wh = "01" Or wh = "60" Then
          Dim tg As String, bn As String
          tg = Trim$(CStr(srcArr(i, SRC_COL_BATCH) & ""))
          If Len(tg) > 0 Then
            bn = Trim$(CStr(srcArr(i, SRC_COL_BIN) & ""))
            k = k + 1
            arrTag(k) = tg
            arrBin(k) = bn
            keyStr = tg & vbTab & bn
            If seen.Exists(keyStr) Then
              seen(keyStr) = seen(keyStr) + 1
            Else
              seen.Add keyStr, 1
            End If
          Else
            boQua = boQua + 1
          End If
        End If
      End If
      If (i Mod 500) = 0 Then
        Application.StatusBar = "FGRP: dang loc " & i & "/" & nRows & " dong..."
      End If
    Next i

    For Each it In seen.Keys
      If seen(it) > 1 Then
        dupGroups = dupGroups + 1
        dupRows = dupRows + seen(it) - 1
        If dupGroups <= 5 Then
          dupViDu = dupViDu & vbCrLf & "  - " & Replace(CStr(it), vbTab, " | ") & " (x" & seen(it) & ")"
        End If
      End If
    Next it

    Set ws = EnsureSheet(SHEET_TON_KHO)
    ws.Cells.Clear
    If k > 0 Then
      ReDim outArr(1 To k + 1, 1 To 2)
      outArr(1, 1) = "Tag ID"
      outArr(1, 2) = "Bin"
      For i = 1 To k
        outArr(i + 1, 1) = arrTag(i)
        outArr(i + 1, 2) = arrBin(i)
      Next i
      ws.Range("A1").Resize(k + 1, 2).Value2 = outArr
    End If

    Application.StatusBar = False
    msg = "DA LAY DU LIEU NHAP KHO" & vbCrLf & vbCrLf & _
          "File nguon: " & path & vbCrLf & _
          "Sheet nguon: " & sheetNguon & vbCrLf & _
          "Tong dong du lieu doc: " & (nRows - 1) & vbCrLf & _
          "Dong hop le (A=8/1220 va B=01/60): " & k & vbCrLf & _
          "Bo qua (BATCH rong): " & boQua & vbCrLf & _
          "Da ghi vao sheet '" & ws.Name & "' (Tag ID, Bin)"
    If dupGroups > 0 Then
      msg = msg & vbCrLf & vbCrLf & _
            "CANH BAO: " & dupRows & " dong du do trung cap Tag ID + Bin (" & dupGroups & " nhom)." & vbCrLf & _
            "Server se TU CHOI khi bam day. Vi du:" & dupViDu & vbCrLf & vbCrLf & _
            "Hay sua file nguon truoc khi day len."
      MsgBox msg, vbExclamation, "FGRP API"
    Else
      MsgBox msg & vbCrLf & vbCrLf & "Buoc tiep theo: bam nut FGRP_DayTonKho de day len.", vbInformation, "FGRP API"
    End If
  Else
    ' ===== LOC KIEU CAP NHAT NGUON: chi A starts 8/1220 -> (A,B,C,D,F) =====
    Dim arrStock() As String, arrWh() As String, arrDate() As String
    Dim arrBatch() As String, arrQty() As Variant

    ReDim arrStock(1 To nRows)
    ReDim arrWh(1 To nRows)
    ReDim arrDate(1 To nRows)
    ReDim arrBatch(1 To nRows)
    ReDim arrQty(1 To nRows)

    For i = 2 To nRows
      If IsMaNguonHopLe(srcArr(i, SRC_COL_STOCK)) Then
        k = k + 1
        arrStock(k) = Trim$(CStr(srcArr(i, SRC_COL_STOCK) & ""))
        ' Warehouse giu nguyen gia tri goc (giong web: 1 -> "1", 60 -> "60")
        arrWh(k) = Trim$(CStr(srcArr(i, SRC_COL_WAREHOUSE) & ""))
        arrDate(k) = DateToDdMmVy(srcArr(i, SRC_COL_CREATEDATE))
        arrBatch(k) = Trim$(CStr(srcArr(i, SRC_COL_BATCH) & ""))
        arrQty(k) = srcArr(i, SRC_COL_QTY)
      End If
      If (i Mod 500) = 0 Then
        Application.StatusBar = "FGRP: dang loc " & i & "/" & nRows & " dong..."
      End If
    Next i

    Set ws = EnsureSheet(SHEET_MASTER)
    ws.Cells.Clear
    If k > 0 Then
      ReDim outArr(1 To k + 1, 1 To 5)
      outArr(1, 1) = "Stock Code"
      outArr(1, 2) = "Warehouse"
      outArr(1, 3) = "CREATEDATE"
      outArr(1, 4) = "BATCH"
      outArr(1, 5) = "Qty"
      For i = 1 To k
        outArr(i + 1, 1) = arrStock(i)
        outArr(i + 1, 2) = arrWh(i)
        outArr(i + 1, 3) = arrDate(i)
        outArr(i + 1, 4) = arrBatch(i)
        outArr(i + 1, 5) = arrQty(i)
      Next i
      ws.Range("A1").Resize(k + 1, 5).Value2 = outArr
    End If

    Application.StatusBar = False
    MsgBox "DA LAY DU LIEU CAP NHAT NGUON" & vbCrLf & vbCrLf & _
           "File nguon: " & path & vbCrLf & _
           "Sheet nguon: " & sheetNguon & vbCrLf & _
           "Tong dong du lieu doc: " & (nRows - 1) & vbCrLf & _
           "Dong hop le (A bat dau 8/1220): " & k & vbCrLf & _
           "Da ghi vao sheet '" & ws.Name & "' (Stock Code, Warehouse, CREATEDATE, BATCH, Qty)" & vbCrLf & vbCrLf & _
           "Buoc tiep theo: kiem tra roi bam FGRP_DayCapNhatNguonThuNghiem (thu) hoac FGRP_DayCapNhatNguon (that).", _
           vbInformation, "FGRP API"
  End If
  Exit Sub

Fail:
  Application.StatusBar = False
  MsgBox "Loi lay du lieu tu file nguon:" & vbCrLf & Err.Description, vbCritical, "FGRP API"
End Sub

Private Function ChonFileNguon() As String
  Dim f As Variant
  f = Application.GetOpenFilename( _
        "File Excel (*.xlsx;*.xls),*.xlsx;*.xls", , _
        "Chon file nguon (Stock Balance With Batch)")
  If VarType(f) = vbBoolean Then
    ChonFileNguon = ""
  Else
    ChonFileNguon = CStr(f)
  End If
End Function

Private Function ReadFirstSheetArr(ByVal path As String, ByRef sheetName As String) As Variant
  Dim wb As Workbook, ws As Worksheet, arr As Variant
  Set wb = Workbooks.Open(Filename:=path, ReadOnly:=True, UpdateLinks:=0, AddToMru:=False)
  Set ws = wb.Worksheets(1)
  sheetName = ws.Name
  arr = ws.UsedRange.Value2
  wb.Close SaveChanges:=False
  ReadFirstSheetArr = arr
End Function

' Cot A hop le: bat dau bang "8" hoac "1220" (so sanh dang text nen nhan ca o so)
Private Function IsMaNguonHopLe(ByVal v As Variant) As Boolean
  Dim s As String
  If IsEmpty(v) Or IsNull(v) Then Exit Function
  s = Trim$(CStr(v))
  If Len(s) = 0 Then Exit Function
  If Left$(s, 1) = "8" Or Left$(s, 4) = "1220" Then IsMaNguonHopLe = True
End Function

' Chuan hoa Warehouse de SO SANH loc: o dang so 1 -> "01", 60 -> "60".
' (Gia tri GHI vao sheet/database van giu nguyen ban goc - giong web)
Private Function NormalizeWh(ByVal v As Variant) As String
  Dim s As String
  If IsEmpty(v) Or IsNull(v) Then Exit Function
  s = Trim$(CStr(v))
  If Len(s) = 0 Then Exit Function
  If IsNumeric(s) Then
    Dim d As Double
    d = CDbl(s)
    If d = Int(d) And d >= 0 And d <= 99 Then
      NormalizeWh = Format$(d, "00")
      Exit Function
    End If
  End If
  NormalizeWh = s
End Function

Private Function EnsureSheet(ByVal name As String) As Worksheet
  Dim ws As Worksheet
  On Error Resume Next
  Set ws = ThisWorkbook.Worksheets(name)
  On Error GoTo 0
  If ws Is Nothing Then
    Set ws = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
    ws.Name = name
  End If
  Set EnsureSheet = ws
End Function

' ================= HTTP + JSON =================

Private Function HttpPostRpc(ByVal rpcName As String, ByVal jsonBody As String) As String
  Dim http As Object
  Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
  http.Open "POST", FGRP_URL & "/rest/v1/rpc/" & rpcName, False
  http.SetRequestHeader "apikey", FGRP_ANON_KEY
  http.SetRequestHeader "Authorization", "Bearer " & FGRP_ANON_KEY
  http.SetRequestHeader "Content-Type", "application/json; charset=utf-8"
  http.SetRequestHeader "Accept", "application/json"
  http.Send jsonBody
  If http.Status < 200 Or http.Status >= 300 Then
    Err.Raise vbObjectError + 2100, , "HTTP " & http.Status & " - " & ExtractJsonMessage(CStr(http.ResponseText))
  End If
  HttpPostRpc = CStr(http.ResponseText)
End Function

Private Function ExtractJsonMessage(ByVal raw As String) As String
  Dim p As Long, p2 As Long, msg As String
  p = InStr(1, raw, """message"":""")
  If p = 0 Then
    ExtractJsonMessage = raw
    Exit Function
  End If
  p = p + Len("""message"":""")
  p2 = InStr(p, raw, """")
  If p2 = 0 Then
    ExtractJsonMessage = raw
    Exit Function
  End If
  msg = Mid$(raw, p, p2 - p)
  ExtractJsonMessage = msg
End Function

Private Function JsonEscape(ByVal s As String) As String
  Dim i As Long, ch As Long, out As String
  For i = 1 To Len(s)
    ch = AscW(Mid$(s, i, 1))
    If ch < 0 Then ch = ch + 65536
    Select Case ch
      Case 34: out = out & "\"""
      Case 92: out = out & "\\"
      Case 8: out = out & "\b"
      Case 9: out = out & "\t"
      Case 10: out = out & "\n"
      Case 12: out = out & "\f"
      Case 13: out = out & "\r"
      Case Is < 32
        out = out & "\u" & Right$("0000" & Hex$(ch), 4)
      Case Is < 127
        out = out & Chr$(ch)
      Case Else
        If ch >= 55296 And ch <= 56319 Then
          ' Cap surrogate (emoji, ky tu ngoai BMP): ghep thanh code point day du
          If i < Len(s) Then
            Dim lo As Long
            lo = AscW(Mid$(s, i + 1, 1))
            If lo < 0 Then lo = lo + 65536
            If lo >= 56320 And lo <= 57343 Then
              Dim cp As Long
              cp = 65536 + (ch - 55296) * 1024 + (lo - 56320)
              out = out & "\u" & Right$("0000" & Hex$((cp \ 1024) + 55296), 4) & _
                          "\u" & Right$("0000" & Hex$((cp Mod 1024) + 56320), 4)
              i = i + 1
            Else
              out = out & "\u" & Right$("0000" & Hex$(ch), 4)
            End If
          Else
            out = out & "\u" & Right$("0000" & Hex$(ch), 4)
          End If
        Else
          out = out & "\u" & Right$("0000" & Hex$(ch), 4)
        End If
    End Select
  Next i
  JsonEscape = out
End Function

Private Function NumToJson(ByVal v As Variant) As String
  If IsEmpty(v) Or IsNull(v) Then
    NumToJson = "0"
    Exit Function
  End If
  Dim s As String
  s = Trim$(CStr(v))
  If Len(s) = 0 Then
    NumToJson = "0"
    Exit Function
  End If
  If IsNumeric(s) Then
    ' JSON phai dung dau cham thap phan - Str$ co the tra dau phay theo locale (VN)
    NumToJson = Replace(Trim$(Str$(CDbl(s))), ",", ".")
  Else
    NumToJson = "0"
  End If
End Function

Private Function DateToDdMmVy(ByVal v As Variant) As String
  If IsEmpty(v) Or IsNull(v) Then
    DateToDdMmVy = ""
    Exit Function
  End If
  If IsNumeric(v) And VarType(v) <> vbString Then
    Dim d As Double
    d = CDbl(v)
    If d >= 20000 And d <= 80000 Then
      DateToDdMmVy = Format$(CDate(d), "dd/mm/yyyy")
    Else
      DateToDdMmVy = Trim$(CStr(v))
    End If
    Exit Function
  End If
  Dim s As String
  s = Trim$(CStr(v))
  If s Like "##/##/####" Then
    DateToDdMmVy = s
  ElseIf IsDate(s) Then
    DateToDdMmVy = Format$(CDate(s), "dd/mm/yyyy")
  Else
    DateToDdMmVy = s
  End If
End Function

' ================= SHEET / HEADER =================

Private Function ResolveSheet(ByVal preferredName As String) As Worksheet
  Dim ws As Worksheet
  On Error Resume Next
  Set ws = ThisWorkbook.Worksheets(preferredName)
  On Error GoTo 0
  If ws Is Nothing Then
    Set ws = ActiveSheet
    MsgBox "Khong tim thay sheet '" & preferredName & "'." & vbCrLf & _
           "Tam dung sheet dang mo: '" & ws.Name & "'.", vbExclamation, "FGRP API"
  End If
  Set ResolveSheet = ws
End Function

Private Function HeaderRowArray(ByVal arr As Variant) As Variant
  Dim n As Long, j As Long
  n = UBound(arr, 2)
  Dim out() As String
  ReDim out(1 To n)
  For j = 1 To n
    out(j) = CStr(arr(1, j) & "")
  Next j
  HeaderRowArray = out
End Function

Private Function FindCol(ByVal headers As Variant, ByVal aliases As Variant) As Long
  Dim j As Long, k As Long
  For j = LBound(headers) To UBound(headers)
    Dim h As String
    h = NormHeader(headers(j))
    If Len(h) > 0 Then
      For k = LBound(aliases) To UBound(aliases)
        If h = aliases(k) Then
          FindCol = j
          Exit Function
        End If
      Next k
    End If
  Next j
  FindCol = 0
End Function

' Chuan hoa tieu de: chu thuong, bo dau tieng Viet, chi giu a-z 0-9
Private Function NormHeader(ByVal v As Variant) As String
  Dim t As String, i As Long, out As String, ch As String
  t = LCase$(Trim$(CStr(v & "")))
  t = RemoveVietnameseTones(t)
  For i = 1 To Len(t)
    ch = Mid$(t, i, 1)
    If (ch >= "a" And ch <= "z") Or (ch >= "0" And ch <= "9") Then
      out = out & ch
    End If
  Next i
  NormHeader = out
End Function

Private Function RemoveVietnameseTones(ByVal s As String) As String
  Dim res As String
  res = s
  res = ReplaceChars(res, Array(224, 225, 7843, 227, 7841, 259, 7855, 7857, 7859, 7861, 7863, 226, 7845, 7847, 7849, 7851, 7853), "a")
  res = ReplaceChars(res, Array(232, 233, 7867, 7869, 7865, 234, 7871, 7873, 7875, 7877, 7879), "e")
  res = ReplaceChars(res, Array(236, 237, 7881, 297, 7883), "i")
  res = ReplaceChars(res, Array(242, 243, 7887, 245, 7885, 244, 7889, 7891, 7893, 7895, 7897, 417, 7899, 7901, 7903, 7905, 7907), "o")
  res = ReplaceChars(res, Array(249, 250, 7911, 361, 7909, 432, 7913, 7915, 7917, 7919, 7921), "u")
  res = ReplaceChars(res, Array(7923, 253, 7927, 7929, 7925), "y")
  res = ReplaceChars(res, Array(273), "d")
  RemoveVietnameseTones = res
End Function

Private Function ReplaceChars(ByVal s As String, ByVal codes As Variant, ByVal replacement As String) As String
  Dim res As String, i As Long
  res = s
  For i = LBound(codes) To UBound(codes)
    res = Replace(res, ChrW(codes(i)), replacement)
  Next i
  ReplaceChars = res
End Function
