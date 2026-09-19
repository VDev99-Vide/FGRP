<template>
  <div class="flex flex-col flex-1 space-y-6">
    
    <!-- 1. Top Action Cards / Nạp Dữ Liệu & Thống Kê Tổng Quan -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      
      <!-- Card Thao Tác Nạp Dữ Liệu -->
      <div class="md:col-span-1 glass-card-dark p-4 rounded-2xl border border-white/10 flex flex-col justify-between gap-3">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="w-2 h-2 rounded-full bg-[#00C2FF] animate-pulse"></span>
            <p class="text-[10px] font-bold text-[#00C2FF] uppercase tracking-wider">THAO TÁC HỆ THỐNG</p>
          </div>
          <h3 class="text-sm font-bold text-white">Nạp Dữ Liệu Xuất Hàng</h3>
          <p class="text-[10px] text-[#AEB9E1] mt-0.5">
            Nhập file Excel .xlsx, Feature & PCS/pkg tham chiếu metadata
          </p>
        </div>

        <div class="flex gap-2">
          <button 
            @click="showUploadModal = true"
            class="flex-1 h-[38px] btn-neon-purple rounded-[8px] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm active:scale-95"
          >
            <UploadCloud class="w-4 h-4" />
            <span>NẠP FILE EXCEL</span>
          </button>
          <button 
            @click="handleManualSync"
            :title="'Đồng bộ trực tiếp Supabase (Lần cuối: ' + lastSync + ')'"
            class="w-[38px] h-[38px] bg-white/5 hover:bg-white/10 border border-white/15 rounded-[8px] flex items-center justify-center text-[#AEB9E1] hover:text-white transition cursor-pointer active:scale-95"
          >
            <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin text-[#00C2FF]' : '']" />
          </button>
          <button 
            v-if="stats.totalContainers > 0"
            @click="handleClearAll"
            title="Xóa toàn bộ dữ liệu xuất hàng trên Supabase"
            class="w-[38px] h-[38px] bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-[8px] flex items-center justify-center text-red-400 hover:text-red-300 transition cursor-pointer active:scale-95"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Metric 1: Tổng Container & Đơn Hàng -->
      <div class="glass-card-dark p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
        <div class="w-11 h-11 rounded-xl bg-[#00C2FF]/15 border border-[#00C2FF]/30 flex items-center justify-center text-[#00C2FF] shrink-0">
          <Truck class="w-5 h-5" />
        </div>
        <div>
          <p class="text-[11px] font-semibold text-[#AEB9E1]">Tổng Container / Đơn</p>
          <div class="flex items-baseline gap-2 mt-0.5">
            <span class="text-xl font-bold text-white font-mono">{{ stats.totalContainers }}</span>
            <span class="text-[10px] text-[#AEB9E1]">Cont</span>
          </div>
          <p class="text-[10px] text-[#00C2FF] mt-0.5">Lọc ngày tăng dần</p>
        </div>
      </div>

      <!-- Metric 2: Tổng Số Kiện (#pkg) Cần Chuẩn Bị -->
      <div class="glass-card-dark p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
        <div class="w-11 h-11 rounded-xl bg-[#CB3CFF]/15 border border-[#CB3CFF]/30 flex items-center justify-center text-[#CB3CFF] shrink-0">
          <Box class="w-5 h-5" />
        </div>
        <div>
          <p class="text-[11px] font-semibold text-[#AEB9E1]">Tổng Số Lượng Quy Đổi</p>
          <div class="flex items-baseline gap-2 mt-0.5 flex-wrap">
            <span class="text-xl font-bold text-[#CB3CFF] font-mono">{{ stats.totalPkg.toLocaleString() }}</span>
            <span class="text-[10px] text-[#CB3CFF]">Kiện</span>
            <span v-if="stats.totalBoxes > 0" class="text-white/40">/</span>
            <span v-if="stats.totalBoxes > 0" class="text-xl font-bold text-[#FDB52A] font-mono">{{ stats.totalBoxes.toLocaleString() }}</span>
            <span v-if="stats.totalBoxes > 0" class="text-[10px] text-[#FDB52A]">Thùng</span>
          </div>
          <p class="text-[10px] text-[#AEB9E1] mt-0.5">Kiện FG + Thùng Phụ Kiện</p>
        </div>
      </div>

      <!-- Metric 3: Trạng Thái Chuẩn Bị (Pending / Ready) -->
      <div class="glass-card-dark p-4 rounded-2xl border border-white/10 flex items-center gap-3.5">
        <div class="w-11 h-11 rounded-xl bg-[#14CA74]/15 border border-[#14CA74]/30 flex items-center justify-center text-[#14CA74] shrink-0">
          <CheckCircle2 class="w-5 h-5" />
        </div>
        <div>
          <p class="text-[11px] font-semibold text-[#AEB9E1]">Tiến Độ Chuẩn Bị</p>
          <div class="flex items-baseline gap-2 mt-0.5">
            <span class="text-lg font-bold text-[#14CA74] font-mono">{{ stats.readyCount }}</span>
            <span class="text-[10px] text-[#AEB9E1]">Đã xong /</span>
            <span class="text-lg font-bold text-[#FDB52A] font-mono">{{ stats.pendingCount }}</span>
            <span class="text-[10px] text-[#AEB9E1]">Chờ</span>
          </div>
          <p class="text-[10px] text-[#AEB9E1] mt-0.5">Xóa thủ công (đã bỏ tự xóa 3 ngày)</p>
        </div>
      </div>

    </div>

    <!-- 2. Bảng Danh Sách Xuất Hàng Dự Kiến -->
    <div class="glass-card-dark p-5 sm:p-6 flex flex-col gap-4 flex-1 min-h-0">
      
      <!-- Filter Bar & Controls -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <p class="text-[10px] font-bold text-[#CB3CFF] uppercase tracking-widest mb-1">
            KẾ HOẠCH ĐÓNG CONTAINER
          </p>
          <h2 class="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Danh Sách Xuất Hàng Dự Kiến</span>
            <span class="text-xs px-2.5 py-0.5 rounded-full bg-[#00C2FF]/15 border border-[#00C2FF]/30 text-[#00C2FF] font-mono font-semibold">
              {{ filteredContainers.length }} Container
            </span>
          </h2>
        </div>

        <!-- Filter Controls -->
        <div class="flex flex-wrap gap-2.5 w-full sm:w-auto items-center">
          
          <!-- Status Filter Tabs (chỉ 2 mục: Chờ chuẩn bị / Đã xong, bỏ Tất cả) -->
          <div class="flex items-center gap-1 bg-[#18202D]/90 border border-white/15 p-1 rounded-[8px] text-xs">
            <button 
              @click="statusFilter = 'pending'"
              :class="[
                'px-2.5 py-1 rounded-[6px] text-xs font-bold transition cursor-pointer',
                statusFilter === 'pending' ? 'bg-[#FDB52A] text-[#081028] shadow-[0_0_8px_#FDB52A]' : 'text-[#AEB9E1] hover:text-white'
              ]"
            >
              Chờ chuẩn bị ({{ stats.pendingCount }})
            </button>
            <button 
              @click="statusFilter = 'ready'"
              :class="[
                'px-2.5 py-1 rounded-[6px] text-xs font-bold transition cursor-pointer',
                statusFilter === 'ready' ? 'bg-[#14CA74] text-[#081028] shadow-[0_0_8px_#14CA74]' : 'text-[#AEB9E1] hover:text-white'
              ]"
            >
              Đã xong ({{ stats.readyCount }})
            </button>
          </div>

          <!-- Smart Search Bar -->
          <div class="relative flex-1 sm:w-64">
            <input 
              type="text" 
              v-model="quickFilterText"
              placeholder="Tìm PO, SO, Item, Feature, Ngày..." 
              class="w-full h-[36px] px-3 pl-8 bg-[#18202D]/80 backdrop-blur-md border border-white/15 rounded-[8px] text-xs outline-none text-white placeholder-[#AEB9E1]/50 focus:border-[#CB3CFF] focus:ring-1 ring-[#CB3CFF] transition"
            >
            <Search class="w-3.5 h-3.5 text-[#AEB9E1] absolute left-2.5 top-2.5" />
          </div>

        </div>
      </div>

      <!-- Scrolling Table Container với cơ chế cuộn mượt 50 dòng thông minh -->
      <!-- Mặc định 50 dòng, khi cuộn chuột xuống tự render thêm, cuộn ngược lên tự động ẩn dòng 51 trở đi -->
      <div 
        ref="scrollContainerRef"
        @scroll="handleTableScroll"
        class="w-full h-[460px] md:h-[520px] lg:h-[580px] 2xl:h-[680px] max-h-[72vh] rounded-[14px] border border-white/15 bg-white/[0.02] shadow-inner relative custom-scroll"
        style="overflow-y: scroll; overflow-x: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #CB3CFF rgba(24, 32, 45, 0.9); -webkit-overflow-scrolling: touch;"
      >
        <table class="w-full text-left text-xs whitespace-nowrap border-collapse">
          
          <!-- Sticky Table Head (Đồng bộ kính mờ toàn hệ thống) -->
          <thead class="glass-table-sticky-head shadow-lg">
            <tr>
              <th class="py-3.5 px-3 font-bold text-[11px] tracking-wider uppercase text-center w-[36px]">
                <input type="checkbox" :checked="isAllVisibleSelected" @change="toggleSelectAllVisible" title="Chọn tất cả dòng đang hiển thị" class="w-3.5 h-3.5 accent-[#CB3CFF] cursor-pointer" />
              </th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase">PO & SO / ĐƠN HÀNG</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-center">FEATURE</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase">LPVN ITEM CODE</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-right">TỔNG QTY (PCS)</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-right">QUY CÁCH (PCS/PKG · meta)</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-center">SỐ KIỆN / THÙNG (#PKG)</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-center">LOADING DATE</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-center">TRẠNG THÁI</th>
              <th class="py-3.5 px-4 font-bold text-[11px] tracking-wider uppercase text-center">THAO TÁC</th>
            </tr>
          </thead>

          <!-- Table Body -->
          <tbody class="divide-y divide-white/[0.06] font-medium">
            <template v-for="row in renderedDisplayRows" :key="row._id">
              
              <!-- 1. CONTAINER GROUP HEADER ROW (Banner phân nhóm container, đồng bộ kính mờ, không ghim để chống chồng lớp màu) -->
              <tr 
                v-if="row._type === 'container-header'"
                :class="[
                  'border-y font-bold transition-colors',
                  row.container.status === 'ready'
                    ? 'border-[#14CA74]/30'
                    : 'border-[#CB3CFF]/30'
                ]"
              >
                <td 
                  colspan="10" 
                  :class="[
                    'py-3 px-4 glass-panel-subtle backdrop-blur-md',
                    row.container.status === 'ready'
                      ? 'bg-gradient-to-r from-[#14CA74]/15 via-[#00C2FF]/10 to-transparent'
                      : 'bg-gradient-to-r from-[#CB3CFF]/15 via-[#00C2FF]/10 to-transparent'
                  ]"
                >
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    
                    <!-- Left: Checkbox + PO, SO, Cont No, Loading Date -->
                    <div class="flex items-center gap-3">
                      <input type="checkbox" :checked="isContainerSelected(row.container)" @change="toggleContainer(row.container)" title="Chọn toàn bộ container này để xóa" class="w-3.5 h-3.5 accent-[#CB3CFF] cursor-pointer shrink-0" />
                      <div 
                        :class="[
                          'w-2 h-5 rounded-full shadow-sm',
                          row.container.status === 'ready'
                            ? 'bg-[#14CA74] shadow-[0_0_8px_#14CA74]'
                            : 'bg-[#CB3CFF] shadow-[0_0_8px_#CB3CFF]'
                        ]"
                      />
                      
                      <!-- PO & SO Title -->
                      <div class="flex items-center gap-2">
                        <span class="text-white text-xs font-black tracking-wide font-mono">
                          PO: {{ row.container.po }}
                        </span>
                        <span class="text-white/40 font-mono">|</span>
                        <span class="text-white text-xs font-black tracking-wide font-mono">
                          SO: {{ row.container.so }}
                        </span>
                        <span v-if="row.container.container_no" class="text-[11px] font-mono text-[#00C2FF] bg-[#00C2FF]/15 border border-[#00C2FF]/30 px-2 py-0.5 rounded-[4px]">
                          Cont: {{ row.container.container_no }}
                        </span>
                      </div>

                      <!-- Badge nếu có Phụ Kiện -->
                      <span v-if="row.container.hasAccessories" class="text-[10px] font-bold px-2 py-0.5 rounded-[4px] bg-[#FDB52A]/15 text-[#FDB52A] border border-[#FDB52A]/30 flex items-center gap-1">
                        <Package class="w-3 h-3 text-[#FDB52A]" />
                        <span>Có phụ kiện</span>
                      </span>

                      <!-- Loading Date Badge (Sắp xếp từ nhỏ tới lớn) -->
                      <span class="text-[11px] font-mono font-bold text-[#AEB9E1] bg-white/10 border border-white/15 px-2.5 py-0.5 rounded-[5px] flex items-center gap-1.5">
                        <Calendar class="w-3 h-3 text-[#00C2FF]" />
                        <span>Loading: {{ row.container.loading_date }}</span>
                      </span>

                      <!-- Nút LỌC NHANH SANG TỒN KHO THÀNH PHẨM ĐÃ BỎ Ở HEADER (T2) — giữ nút Lọc tồn trong hàng theo Feature -->

                    </div>

                    <!-- Right: Total Kiện/Thùng, Total PCS, Thao tác "Chuẩn bị xong" -->
                    <div class="flex items-center gap-3">
                      <!-- Total Qty -->
                      <span class="text-[11px] font-bold text-white bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-[5px]">
                        Tổng: <b class="text-[#14CA74]">{{ row.container.totalQty.toLocaleString() }}</b> PCS
                      </span>

                      <!-- Total #pkg (Tổng số kiện FG và số thùng phụ kiện) -->
                      <span class="text-xs font-black text-[#CB3CFF] bg-[#CB3CFF]/15 border border-[#CB3CFF]/40 px-3 py-1 rounded-[6px] shadow-[0_0_10px_rgba(203,60,255,0.2)]">
                        Tổng: {{ row.container.summaryPkgLabel }}
                      </span>

                      <!-- THAO TÁC "CHUẨN BỊ XONG" (màu xanh dương để tránh trùng xanh lá Đã xong) -->
                      <div v-if="row.container.status === 'pending'">
                        <button 
                          @click="handleMarkReady(row.container)"
                          title="Đánh dấu đơn hàng container đã chuẩn bị xong (tự nhảy qua tab Đã xong, xóa thủ công)"
                          class="h-[28px] px-3 rounded-[6px] bg-[#00C2FF]/20 hover:bg-[#00C2FF]/35 border border-[#00C2FF]/50 text-[#00C2FF] hover:text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
                        >
                          <CheckCircle2 class="w-3.5 h-3.5" />
                          <span>Chuẩn bị xong</span>
                        </button>
                      </div>

                      <div v-else class="flex items-center gap-2">
                        <span 
                          class="text-[11px] font-bold text-[#14CA74] bg-[#14CA74]/20 border border-[#14CA74]/40 px-2.5 py-1 rounded-[6px] flex items-center gap-1.5"
                          title="Đã chuẩn bị xong — xóa thủ công (đã bỏ tự xóa 3 ngày)"
                        >
                          <CheckCircle2 class="w-3.5 h-3.5" />
                          <span>Đã xong</span>
                        </span>

                        <button 
                          @click="handleRevertPending(row.container)"
                          title="Khôi phục trạng thái về Chờ chuẩn bị"
                          class="text-[10px] text-[#AEB9E1] hover:text-white underline cursor-pointer"
                        >
                          Hoàn lại
                        </button>
                      </div>
                    </div>

                  </div>
                </td>
              </tr>

              <!-- 2. FEATURE GROUP ROW (MỖI FEATURE LÀ 1 DÒNG TỔNG HỢP DUY NHẤT) -->
              <tr 
                v-else-if="row._type === 'feature-row' && row.featureGroup"
                class="transition-colors duration-150 hover:bg-white/[0.08]"
              >
                <!-- Checkbox chọn feature -->
                <td class="py-3 px-3 text-center">
                  <input type="checkbox" :checked="isFeatureSelected(row.featureGroup)" @change="toggleFeature(row.container, row.featureGroup)" title="Chọn dòng feature này để xóa" class="w-3.5 h-3.5 accent-[#CB3CFF] cursor-pointer" />
                </td>
                <!-- PO / SO -->
                <td class="py-3 px-4 font-mono text-[#AEB9E1] text-[11px]">
                  {{ row.container.po }} / {{ row.container.so }}
                </td>

                <!-- Feature -->
                <td class="py-3 px-4 text-center">
                  <div class="flex flex-col items-center gap-1">
                    <span 
                      v-if="row.featureGroup.is_accessory"
                      class="font-mono font-bold text-[#FDB52A] text-xs px-2.5 py-1 rounded-[6px] bg-[#FDB52A]/15 border border-[#FDB52A]/30 flex items-center gap-1 shadow-sm"
                    >
                      <Package class="w-3 h-3 text-[#FDB52A]" />
                      <span>{{ row.featureGroup.feature }}</span>
                    </span>
                    <span 
                      v-else-if="row.featureGroup.feature === '1220' || row.featureGroup.is_special"
                      class="font-mono font-black text-[#CB3CFF] text-xs px-2.5 py-1 rounded-[6px] bg-[#CB3CFF]/15 border border-[#CB3CFF]/30 shadow-[0_0_8px_rgba(203,60,255,0.2)]"
                    >
                      ★ Mã 1220
                    </span>
                    <span 
                      v-else
                      class="font-mono font-black text-[#CB3CFF] text-xs px-2.5 py-1 rounded-[6px] bg-[#CB3CFF]/15 border border-[#CB3CFF]/30 shadow-[0_0_8px_rgba(203,60,255,0.2)]"
                    >
                      {{ row.featureGroup.feature }}
                    </span>

                    <!-- Tag phân biệt loại hàng -->
                    <span 
                      v-if="row.featureGroup.is_accessory"
                      class="text-[9px] font-bold text-[#FDB52A] bg-[#FDB52A]/10 px-1.5 py-0.5 rounded border border-[#FDB52A]/20"
                    >
                      Phụ kiện
                    </span>
                    <span 
                      v-else-if="row.featureGroup.is_box && row.featureGroup.feature !== '1220' && !row.featureGroup.is_special"
                      class="text-[9px] font-bold text-[#00C2FF] bg-[#00C2FF]/10 px-1.5 py-0.5 rounded border border-[#00C2FF]/20"
                    >
                      Box
                    </span>
                  </div>
                </td>

                <!-- LPVN Item code (Chỉ hiển thị danh sách LPVN ITEM CODE) -->
                <td class="py-3 px-4">
                  <div class="flex flex-col gap-1.5 min-w-[180px]">
                    <div 
                      v-for="it in row.featureGroup.items" 
                      :key="it.id || it.item_code"
                      class="flex items-center gap-2 px-2.5 py-1 rounded-[6px] bg-white/[0.04] border border-white/10"
                    >
                      <span class="font-mono font-bold text-[#00C2FF] text-xs">{{ it.item_code }}</span>
                    </div>
                  </div>
                </td>

                <!-- Tổng Qty (PCS) -->
                <td class="py-3 px-4 text-right font-bold text-white text-xs">
                  <span class="text-[#14CA74] font-mono font-bold text-sm">
                    {{ Number(row.featureGroup.totalQty || 0).toLocaleString() }}
                  </span>
                  <p v-if="row.featureGroup.items.length >= 2" class="text-[10px] text-[#AEB9E1] font-mono mt-0.5">
                    ({{ row.featureGroup.items.map(i => Number(i.qty || 0).toLocaleString()).join(' + ') }})
                  </p>
                </td>

                <!-- Quy cách (Pcs/pkg) -->
                <td class="py-3 px-4 text-right font-mono text-white/90 text-xs font-semibold">
                  {{ Number(row.featureGroup.pcs_per_pkg || 0).toLocaleString() }}
                </td>

                <!-- Số kiện / thùng (#pkg) - Chuẩn metadata, 1010 đôi thêm "ước tính" -->
                <td class="py-3 px-4 text-center">
                  <span
                    :class="[
                      'font-mono font-black text-xs px-3 py-1.5 rounded-[6px] border shadow-sm inline-flex items-center gap-1.5',
                      row.featureGroup.is_accessory
                        ? 'bg-[#FDB52A]/15 text-[#FDB52A] border-[#FDB52A]/40 shadow-[0_0_8px_rgba(253,181,42,0.2)]'
                        : 'bg-[#CB3CFF]/20 text-[#CB3CFF] border-[#CB3CFF]/40 shadow-[0_0_8px_rgba(203,60,255,0.25)]'
                    ]"
                    :title="row.featureGroup.missingSpec ? `Thiếu metadata cho feature [${row.featureGroup.feature}] — kiểm tra lại Meta-data Quy cách` : (row.featureGroup.cartonTypeUsed ? `Chuẩn metadata: ${row.featureGroup.packQtyUsed} pcs/kiện (${row.featureGroup.cartonTypeUsed}${row.featureGroup.cartonSpecUsed ? ' · ' + row.featureGroup.cartonSpecUsed : ''})` : '')"
                  >
                    <Box class="w-3.5 h-3.5" />
                    <span><span v-if="row.featureGroup.isEstimated" class="opacity-80 font-bold">ước tính </span>{{ row.featureGroup.pkgCount }} {{ row.featureGroup.unit_type === 'thung' ? 'Thùng' : 'Kiện' }}</span>
                  </span>
                  <p v-if="row.featureGroup.missingSpec" class="text-[10px] text-[#FF5A65] font-bold mt-1">⚠ Thiếu Meta-data [{{ row.featureGroup.feature }}]</p>
                  <p v-else-if="row.featureGroup.isEstimated" class="text-[10px] text-[#CB3CFF] font-bold mt-1">1010 tính theo thùng đôi</p>
                </td>

                <!-- Loading Date -->
                <td class="py-3 px-4 text-center font-mono text-[#AEB9E1] text-[11px]">
                  {{ row.container.loading_date }}
                </td>

                <!-- Status -->
                <td class="py-3 px-4 text-center">
                  <span 
                    :class="[
                      'px-2.5 py-1 rounded-[5px] text-[10px] font-bold border',
                      row.container.status === 'ready'
                        ? 'bg-[#14CA74]/15 text-[#14CA74] border-[#14CA74]/30'
                        : 'bg-[#FDB52A]/15 text-[#FDB52A] border-[#FDB52A]/30'
                    ]"
                  >
                    {{ row.container.status === 'ready' ? 'Đã xong' : 'Chờ xuất' }}
                  </span>
                </td>

                <!-- Thao Tác -->
                <td class="py-3 px-4 text-center">
                  <div class="flex items-center justify-center gap-1.5">
                    <button 
                      @click="handleJumpToInventoryForFeature(row.featureGroup)"
                      title="Lọc tồn kho theo Feature này" 
                      class="px-2.5 py-1 bg-[#00C2FF]/15 hover:bg-[#00C2FF]/25 text-[#00C2FF] rounded-[6px] border border-[#00C2FF]/30 cursor-pointer transition active:scale-95 flex items-center gap-1 text-[11px] font-semibold"
                    >
                      <ExternalLink class="w-3.5 h-3.5" />
                      <span>Lọc tồn</span>
                    </button>
                    <button 
                      @click="triggerEditGroup(row.container, row.featureGroup)"
                      title="Chỉnh sửa toàn bộ Group Feature này" 
                      class="p-1.5 bg-[#CB3CFF]/15 hover:bg-[#CB3CFF]/25 text-[#CB3CFF] rounded-[6px] border border-[#CB3CFF]/30 cursor-pointer transition active:scale-90"
                    >
                      <Edit3 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>

            </template>

            <!-- Trạng Thái Trống -->
            <tr v-if="renderedDisplayRows.length === 0">
              <td colspan="10" class="text-center py-16 text-[#AEB9E1] italic text-xs">
                <div v-if="stats.totalContainers === 0" class="flex flex-col items-center justify-center gap-2.5">
                  <div class="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#AEB9E1]/50 mb-1">
                    <PackageOpen class="w-6 h-6 text-[#AEB9E1]/70" />
                  </div>
                  <span class="text-sm font-semibold text-white/90">Hệ thống chưa có dữ liệu xuất hàng dự kiến</span>
                  <p class="text-[11px] text-[#AEB9E1]/70 max-w-md text-center leading-relaxed">
                    Dữ liệu được đồng bộ trực tiếp 100% từ Supabase (không lưu bất kỳ dữ liệu mẫu hay cache local nào). Vui lòng bấm <b>"NẠP FILE EXCEL"</b> để tải lên kế hoạch xuất hàng!
                  </p>
                  <button 
                    @click="showUploadModal = true"
                    class="mt-1 px-4 py-2 btn-neon-purple rounded-[8px] text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-md active:scale-95"
                  >
                    <UploadCloud class="w-4 h-4" />
                    <span>NẠP FILE EXCEL NGAY</span>
                  </button>
                </div>
                <div v-else class="flex flex-col items-center justify-center gap-2">
                  <Search class="w-6 h-6 text-[#AEB9E1]/40" />
                  <span>Không tìm thấy container hoặc đơn hàng phù hợp với bộ lọc!</span>
                </div>
              </td>
            </tr>
          </tbody>

        </table>
      </div>

      <!-- Footer Info & Bulk Delete -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs border-t border-white/[0.08]">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[#AEB9E1]">
          <span>
            Đang hiển thị: <b class="text-white">{{ renderedDisplayRows.length }}</b> / {{ allDisplayRows.length }} dòng
          </span>
          <span class="text-white/20">|</span>
          <span v-if="selectedCount > 0" class="text-[#CB3CFF] font-bold">Đã chọn: {{ selectedCount }} dòng</span>
          <span v-if="selectedCount > 0" class="text-white/20">|</span>
          <span class="text-[11px] text-[#00C2FF]">
            (Tự render thêm khi cuộn chuột xuống)
          </span>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <button
            v-if="selectedCount > 0"
            @click="showBulkDeleteModal = true"
            class="px-3 py-1.5 bg-[#FF5A65]/15 hover:bg-[#FF5A65]/25 border border-[#FF5A65]/40 text-[#FF5A65] rounded-[6px] text-xs font-bold transition cursor-pointer"
          >
            Xóa đã chọn ({{ selectedCount }})
          </button>
          <span class="text-white/20">|</span>
          <span class="text-xs font-mono text-[#AEB9E1]">Tổng kiện FG: <b class="text-[#CB3CFF] font-bold">{{ stats.totalPkg }}</b> Kiện</span>
          <span class="text-white/20">|</span>
          <span v-if="stats.totalBoxes > 0" class="text-[#FDB52A] text-xs font-mono">
            Tổng thùng PK: <b class="font-bold">{{ stats.totalBoxes }}</b> Thùng
            <span class="text-white/20 ml-2">|</span>
          </span>
          <span class="text-xs font-mono text-[#AEB9E1]">Tổng PCS: <b class="text-[#14CA74] font-bold">{{ stats.totalQty.toLocaleString() }}</b></span>
        </div>
      </div>

    </div>

    <!-- Modals -->
    <!-- 1. Modal Nạp File Excel (cộng dồn + metadata + 1010) -->
    <ForecastUploadModal
      v-model:visible="showUploadModal"
      :loading="loading"
      :metadata-specs="metadataSpecsForPreview"
      :existing-items="forecastItems"
      @upload="handleUploadSubmit"
    />

    <!-- 2. Modal Chỉnh Sửa Dòng Xuất Hàng (Toàn bộ Group Feature) -->
    <ForecastEditModal 
      v-model:visible="showEditModal"
      :group="editingTargetGroup"
      :container="editingTargetContainer"
      :loading="loading"
      @cancel="showEditModal = false"
      @save-group="handleSaveGroup"
      @delete-group="handleDeleteGroup"
    />

    <!-- 3. Floating UI Confirm Modal Xóa Toàn Bộ (Thay thế hoàn toàn confirm trình duyệt) -->
    <ConfirmModal 
      v-model:visible="showClearAllModal"
      title="Xác nhận xóa toàn bộ dữ liệu xuất hàng"
      message="Bạn có chắc chắn muốn xóa TOÀN BỘ danh sách xuất hàng dự kiến trên cơ sở dữ liệu Supabase? Thao tác này sẽ xóa sạch dữ liệu và không thể hoàn tác."
      confirmText="Xác nhận xóa tất cả"
      cancelText="Hủy bỏ"
      severity="danger"
      @confirm="executeClearAll"
    />

    <!-- 4. Confirm Modal Xóa hàng loạt đã chọn -->
    <ConfirmModal
      v-model:visible="showBulkDeleteModal"
      title="Xác nhận xóa các dòng đã chọn"
      :message="`Bạn có chắc muốn xóa ${selectedCount} dòng đã chọn khỏi Supabase? Không thể hoàn tác.`"
      confirmText="Xác nhận xóa"
      cancelText="Hủy bỏ"
      severity="danger"
      @confirm="executeBulkDelete"
    />

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { 
  UploadCloud, 
  Truck, 
  Box, 
  CheckCircle2, 
  Search, 
  Calendar, 
  ExternalLink, 
  Edit3,
  Package,
  PackageOpen,
  RefreshCw,
  Trash2
} from 'lucide-vue-next'
import { useToast } from 'primevue/usetoast'
import { useShippingForecast } from '@/composables/useShippingForecast'
import { useMetadataPacking } from '@/composables/useMetadataPacking'
import { ForecastRawItem, ForecastContainerGroup, ForecastFeatureGroup } from '@/utils/forecast'
import ForecastUploadModal from './ForecastUploadModal.vue'
import ForecastEditModal from './ForecastEditModal.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'

const emit = defineEmits<{
  (e: 'jump-to-inventory', payload: { filterText: string; feature: string }): void
}>()

const toast = useToast()

const {
  forecastItems,
  loading,
  quickFilterText,
  statusFilter,
  stats,
  lastSync,
  filteredContainers,
  fetchForecast,
  setPreferred1010Type,
  setForecastMetadataSpecs,
  addForecastItems,
  editForecastItem,
  deleteForecastItem,
  deleteForecastItems,
  markContainerReady,
  revertContainerPending,
  clearAllForecastData
} = useShippingForecast()

const { rows: metaRows, fetchPackingSpecs } = useMetadataPacking()
const metadataSpecsForPreview = computed(() =>
  (metaRows.value || []).map((r) => ({
    ma_hang: (r as { ma_hang?: string }).ma_hang || (r as { item_code: string }).item_code,
    feature: (r as { feature?: string }).feature || (r as { item_code: string }).item_code,
    item_code: (r as { item_code: string }).item_code,
    pack_qty: Number((r as { pack_qty: number }).pack_qty) || 0,
    carton_type: String((r as { carton_type: string }).carton_type || ''),
    carton_spec: String((r as { carton_spec?: string }).carton_spec || ''),
  })),
)

// Modals State
const showUploadModal = ref(false)
const showEditModal = ref(false)
const showClearAllModal = ref(false)
const showBulkDeleteModal = ref(false)
const editingTargetGroup = ref<ForecastFeatureGroup | null>(null)
const editingTargetContainer = ref<ForecastContainerGroup | null>(null)

// Bulk select (2 cấp: container + feature)
const selectedIds = ref<Set<string>>(new Set())
const selectedCount = computed(() => selectedIds.value.size)
const containerItemIds = (c: ForecastContainerGroup): string[] =>
  (c.allItems || []).map((it) => String(it.id)).filter(Boolean)
const featureItemIds = (fg: ForecastFeatureGroup): string[] =>
  (fg.items || []).map((it) => String(it.id)).filter(Boolean)
const isContainerSelected = (c: ForecastContainerGroup): boolean => {
  const ids = containerItemIds(c)
  return ids.length > 0 && ids.every((id) => selectedIds.value.has(id))
}
const isFeatureSelected = (fg: ForecastFeatureGroup): boolean => {
  const ids = featureItemIds(fg)
  return ids.length > 0 && ids.every((id) => selectedIds.value.has(id))
}
const toggleContainer = (c: ForecastContainerGroup) => {
  const ids = containerItemIds(c)
  const all = ids.every((id) => selectedIds.value.has(id))
  const next = new Set(selectedIds.value)
  if (all) ids.forEach((id) => next.delete(id))
  else ids.forEach((id) => next.add(id))
  selectedIds.value = next
}
const toggleFeature = (_c: ForecastContainerGroup, fg: ForecastFeatureGroup) => {
  const ids = featureItemIds(fg)
  const all = ids.every((id) => selectedIds.value.has(id))
  const next = new Set(selectedIds.value)
  if (all) ids.forEach((id) => next.delete(id))
  else ids.forEach((id) => next.add(id))
  selectedIds.value = next
}
const isAllVisibleSelected = computed(() => {
  const allIds: string[] = []
  allDisplayRows.value.forEach((r) => {
    if (r._type === 'feature-row' && r.featureGroup) allIds.push(...featureItemIds(r.featureGroup))
  })
  return allIds.length > 0 && allIds.every((id) => selectedIds.value.has(id))
})
const toggleSelectAllVisible = () => {
  const allIds: string[] = []
  allDisplayRows.value.forEach((r) => {
    if (r._type === 'feature-row' && r.featureGroup) allIds.push(...featureItemIds(r.featureGroup))
  })
  const all = allIds.every((id) => selectedIds.value.has(id))
  const next = new Set(selectedIds.value)
  if (all) allIds.forEach((id) => next.delete(id))
  else allIds.forEach((id) => next.add(id))
  selectedIds.value = next
}
const clearSelection = () => {
  selectedIds.value = new Set()
}

// Virtual Scrolling State (Mặc định 50 dòng, tự động render thêm khi cuộn xuống, ẩn dòng 51 trở đi khi cuộn lên)
const visibleCount = ref(50)
const scrollContainerRef = ref<HTMLElement | null>(null)

interface DisplayRowItem {
  _id: string
  _type: 'container-header' | 'feature-row'
  container: ForecastContainerGroup
  featureGroup?: ForecastFeatureGroup
}

// Chuyển đổi dữ liệu nhóm thành danh sách các dòng hiển thị phẳng:
// Mỗi Feature Group là 1 dòng tổng hợp duy nhất
const allDisplayRows = computed<DisplayRowItem[]>(() => {
  const rows: DisplayRowItem[] = []
  const q = quickFilterText.value.toLowerCase().trim()

  filteredContainers.value.forEach(container => {
    // Lọc featureGroups nếu có từ khóa tìm kiếm
    let groupsToRender = container.featureGroups

    if (q) {
      const containerMatched = [
        container.po,
        container.so,
        container.container_no,
        container.loading_date
      ].join(' ').toLowerCase().includes(q)

      if (!containerMatched) {
        groupsToRender = container.featureGroups.filter(fg => {
          const fgStr = [
            fg.feature,
            ...fg.items.map(it => it.item_code),
            fg.is_accessory ? 'accessories phukien thung' : '',
            fg.is_special ? 'special 1220' : ''
          ].join(' ').toLowerCase()
          return fgStr.includes(q)
        })
      }
    }

    if (groupsToRender.length === 0) return

    // 1. Container Header Row (PO & SO, Cont, Loading Date, Tổng Kiện / Thùng)
    rows.push({
      _id: `cont-header-${container.containerKey}`,
      _type: 'container-header',
      container
    })

    // 2. Feature Group Rows (Mỗi Feature là 1 dòng duy nhất)
    groupsToRender.forEach(fg => {
      rows.push({
        _id: `fg-${container.containerKey}-${fg.feature}`,
        _type: 'feature-row',
        container,
        featureGroup: fg
      })
    })
  })

  return rows
})

// Danh sách các dòng được render trực tiếp trong DOM (tối đa visibleCount dòng)
const renderedDisplayRows = computed(() => {
  return allDisplayRows.value.slice(0, visibleCount.value)
})

// Xử lý cuộn chuột:
// - Cuộn xuống gần đáy: tự động render thêm 50 dòng
// - Cuộn ngược lên gần đỉnh: tự động ẩn các dòng từ 51 trở đi
const handleTableScroll = (e: Event) => {
  const target = e.target as HTMLElement
  const { scrollTop, scrollHeight, clientHeight } = target

  // Cuộn xuống gần đáy (cách đáy <= 80px): nạp thêm 50 dòng
  if (scrollTop + clientHeight >= scrollHeight - 80) {
    if (visibleCount.value < allDisplayRows.value.length) {
      visibleCount.value = Math.min(allDisplayRows.value.length, visibleCount.value + 50)
    }
  }

  // Cuộn ngược lên đỉnh (scrollTop <= 50px): ẩn dòng 51 trở đi để giải phóng DOM
  if (scrollTop <= 50 && visibleCount.value > 50) {
    visibleCount.value = 50
  }
}

// Reset visible count khi thay đổi filter
watch([quickFilterText, statusFilter], () => {
  visibleCount.value = 50
  clearSelection()
  if (scrollContainerRef.value) {
    scrollContainerRef.value.scrollTop = 0
  }
})

onMounted(() => {
  // Đảm bảo loại bỏ mọi tàn dư cache cũ nếu có
  try {
    localStorage.removeItem('fgrp_forecast_cache')
    sessionStorage.removeItem('fgrp_forecast_cache')
  } catch (e) {}
  fetchPackingSpecs().then(() => {
    setForecastMetadataSpecs(metadataSpecsForPreview.value as unknown as Parameters<typeof setForecastMetadataSpecs>[0])
  })
  fetchForecast()
})

// Đồng bộ metadata vào forecast khi rows thay đổi
watch(metadataSpecsForPreview, (list) => {
  setForecastMetadataSpecs(list as unknown as Parameters<typeof setForecastMetadataSpecs>[0])
})

// Đồng bộ thủ công với Supabase
const handleManualSync = async () => {
  await fetchForecast()
  toast.add({
    severity: 'info',
    summary: 'Đã làm mới',
    detail: 'Dữ liệu đã được đồng bộ trực tiếp 100% từ Supabase',
    life: 2500
  })
}

// Xóa toàn bộ dữ liệu xuất hàng trên Supabase (hiển thị UI nổi thay cho confirm)
const handleClearAll = () => {
  showClearAllModal.value = true
}

const executeClearAll = async () => {
  try {
    await clearAllForecastData()
    clearSelection()
    toast.add({
      severity: 'success',
      summary: 'Đã xóa dữ liệu',
      detail: 'Toàn bộ dữ liệu xuất hàng đã được xóa sạch trên Supabase!',
      life: 3000
    })
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi xóa dữ liệu',
      detail: err.message,
      life: 4000
    })
  }
}

const executeBulkDelete = async () => {
  try {
    const ids = Array.from(selectedIds.value)
    await deleteForecastItems(ids)
    clearSelection()
    toast.add({
      severity: 'success',
      summary: 'Đã xóa các dòng đã chọn',
      detail: `Đã xóa ${ids.length} dòng khỏi Supabase!`,
      life: 3000
    })
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi xóa hàng loạt',
      detail: err.message,
      life: 4000
    })
  }
}

// Thao tác "Chuẩn bị xong" (tự nhảy qua tab Đã xong để tránh render lag)
const handleMarkReady = async (container: ForecastContainerGroup) => {
  try {
    await markContainerReady(container.po, container.so)
    clearSelection()
    toast.add({
      severity: 'success',
      summary: 'Đã chuẩn bị xong',
      detail: `Đơn hàng [PO: ${container.po} - SO: ${container.so}] đã sẵn sàng xuất cont (xóa thủ công, không tự xóa).`,
      life: 4000
    })
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi cập nhật',
      detail: err.message,
      life: 4000
    })
  }
}

// Khôi phục trạng thái về pending
const handleRevertPending = async (container: ForecastContainerGroup) => {
  try {
    await revertContainerPending(container.po, container.so)
    toast.add({
      severity: 'info',
      summary: 'Đã hoàn lại',
      detail: `Đơn hàng [PO: ${container.po} - SO: ${container.so}] chuyển về Chờ chuẩn bị.`,
      life: 3000
    })
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi cập nhật',
      detail: err.message,
      life: 4000
    })
  }
}

// Nút Lọc nhanh header container đã BỎ (T2) — chỉ giữ lọc theo Feature trong hàng.

// Chỉnh sửa toàn bộ Group Feature (áp dụng cả cặp mã nếu có)
const triggerEditGroup = (container: ForecastContainerGroup, fg: ForecastFeatureGroup) => {
  editingTargetContainer.value = container
  editingTargetGroup.value = fg
  showEditModal.value = true
}

// Nút Lọc nhanh theo Group Feature sang Bảng Chi Tiết Tồn Kho Thành Phẩm
const handleJumpToInventoryForFeature = (fg: ForecastFeatureGroup) => {
  const filterKey = fg.feature || fg.items[0]?.item_code || ''
  emit('jump-to-inventory', {
    filterText: filterKey,
    feature: fg.feature
  })
}

// Lưu toàn bộ thay đổi cho Group Feature
const handleSaveGroup = async (items: ForecastRawItem[]) => {
  try {
    for (const item of items) {
      await editForecastItem(item)
    }
    showEditModal.value = false
    toast.add({
      severity: 'success',
      summary: 'Cập nhật thành công',
      detail: `Đã lưu thay đổi cho toàn bộ ${items.length} mã hàng trong Feature!`,
      life: 3000
    })
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi cập nhật',
      detail: err.message,
      life: 4000
    })
  }
}

// Xóa toàn bộ Group Feature
const handleDeleteGroup = async (items: ForecastRawItem[]) => {
  try {
    for (const item of items) {
      if (item.id) {
        await deleteForecastItem(item.id)
      }
    }
    showEditModal.value = false
    toast.add({
      severity: 'success',
      summary: 'Đã xóa group',
      detail: `Đã xóa toàn bộ ${items.length} mã hàng trong group khỏi danh sách xuất`,
      life: 3000
    })
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi xóa',
      detail: err.message,
      life: 4000
    })
  }
}

// Nạp file Excel (cộng dồn + 1010 đơn/đôi)
const handleUploadSubmit = async (rows: ForecastRawItem[], preferred1010Type: string) => {
  try {
    setPreferred1010Type(preferred1010Type || 'thùng đôi')
    await addForecastItems(rows)
    showUploadModal.value = false
    clearSelection()
    toast.add({
      severity: 'success',
      summary: 'Nạp dữ liệu thành công',
      detail: `Đã cộng thêm ${rows.length} dòng kế hoạch xuất hàng vào hệ thống!`,
      life: 4000
    })
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Lỗi nạp dữ liệu',
      detail: err.message,
      life: 4000
    })
  }
}
</script>
