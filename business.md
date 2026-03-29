# KeoTram Ops – Business Requirements Document (BRD / Product Spec)

| Thuộc tính   | Giá trị                                      |
| ------------ | -------------------------------------------- |
| Phiên bản    | 1.1 (bổ sung phạm vi driver – bãi – trạm)   |
| Ngày         | 29/03/2026                                   |
| Tác giả      | Grok (dựa trên toàn bộ yêu cầu đã trao đổi) |

**Lưu ý:** Đây là mô tả phạm vi sản phẩm / tầm nhìn MVP. Đối chiếu với mã nguồn backend hiện tại xem [mục 12](#12-đối-chiếu-triển-khai-backend-repo-keo-be).

---

## 1. Giới thiệu & mục tiêu kinh doanh

**Tên sản phẩm:** KeoTram Ops  
**Ngành:** Vận chuyển & khai thác gỗ keo tràm

**Mục tiêu chính:**  
Xây dựng nền tảng quản lý vận hành + tài chính thời gian thực, thay thế hoàn toàn quy trình thủ công (giấy + Excel), giúp chủ thầu biết chính xác lời/lỗ, kiểm soát tài xế, giảm thất thoát và ra quyết định nhanh.

**Giá trị cốt lõi:**

- Biết lời/lỗ theo ngày/giờ/khu/trạm cân/tài xế
- Kiểm soát chặt chẽ từng chuyến hàng qua approval
- Theo dõi realtime vị trí tài xế (xe đang bận hay rảnh)
- Giảm tối đa gian lận nhờ ảnh bill + audit trail + tracking

---

## 2. Bài toán hiện tại

- Quản lý hoàn toàn thủ công (giấy tờ + Excel)
- Dữ liệu phân tán, không đồng bộ
- Không biết chính xác lời/lỗ thực tế
- Khó đánh giá hiệu quả tài xế
- Dễ xảy ra gian lận (bill giả, chỉnh sửa sau, fake trip, cân sai…)

---

## 3. Giải pháp tổng thể

Hệ thống gồm 3 thành phần:

| Thành phần                         | Mô tả ngắn                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------- |
| **Driver App (Mobile)**            | Tài xế nhập liệu + tracking vị trí                                         |
| **Owner App (Mobile + Web)**       | Chủ thầu quản lý, phê duyệt, xem dashboard realtime                        |
| **Backend + Admin Dashboard (Web)** | Xử lý logic, tính toán tài chính, lưu trữ, chống gian lận                  |

Không có OCR ở MVP (sẽ làm sau). Hiện tại dùng manual entry + chụp ảnh bill.

---

## 4. User roles & quyền hạn

| Role    | Mô tả                    | App truy cập              | Quyền chính                                                                 |
| ------- | ------------------------ | ------------------------- | ---------------------------------------------------------------------------- |
| Driver  | Tài xế vận chuyển        | Driver App (Mobile)       | Nhập receipt, bắt đầu Trip, tracking vị trí (bắt buộc); **chỉ** thao tác trên bãi đã được owner gán và trạm cân thuộc owner quản lý mình *(xem mục 6)* |
| Owner   | Chủ thầu / chủ bãi       | Owner App (Mobile + Web)  | Phê duyệt receipt, xem dashboard & map, quản lý khu & trạm cân; **gán tài xế (managed driver) vào từng bãi** khai thác                      |
| Admin   | Quản trị hệ thống        | Admin Dashboard (Web)     | Quản lý user, override, audit log                                           |

---

## 5. Core business flow (trục xương sống)

**Driver**

1. Bắt đầu Trip (khu khai thác → trạm cân)
2. Nhập manual receipt + chụp ảnh bill
3. Submit → trạng thái Pending

**Owner**

1. Xem danh sách Pending
2. Xem ảnh + dữ liệu → Approve / Reject (bắt buộc lý do nếu reject)

**Backend**

1. Receipt Approved → tính `revenue = weight × unit_price` (theo trạm cân), ghi `finance_records`; nếu receipt có `trip_id` thì cộng dồn `total_tons` / `total_receipts` trên trip (**chỉ tính phiếu đã approved**)
2. Tính profit → cập nhật dashboard realtime *(dashboard API có thể chưa có)*
3. Tracking vị trí driver đang chạy nền *(API ghi/đọc vị trí có thể chưa có)*

**Driver (kết thúc)**

- Khi Trip hoàn thành → kết thúc Trip → xe chuyển sang trạng thái rảnh

---

## 6. Feature list – Driver App

### 6.1 Authentication

- Login bằng số điện thoại + OTP
- Logout

### 6.2 Trip management

- **Điều kiện tài xế:** Tài xế thuộc owner (`managed_by_owner_id`); owner phải **gán bãi** cho tài xế (bảng gán driver–bãi). Không có owner quản lý hoặc chưa gán bãi → không tạo trip / submit receipt hợp lệ.
- **Chọn khu & trạm trên app:** Driver chỉ thấy danh sách **bãi đã được gán** và **trạm cân có `owner` trùng owner quản lý** (GET `harvest-areas`, GET `weighing-stations` — read-only).
- Tạo Trip mới: chọn Harvest Area → Weighing Station (API backend: `POST /trips`, có thể `startNow` để vào luôn trạng thái đang chạy). Backend bắt buộc: bãi đã gán, trạm thuộc cùng owner, trạm `active`.
- Vòng đời backend: `planned` (đã tạo, chưa start) → `in_progress` (sau `POST .../start` hoặc tạo kèm `startNow`) → `completed` hoặc `cancelled`.
- Mỗi tài xế chỉ có **một** trip `in_progress` tại một thời điểm; có thể có nhiều trip `planned` / đã đóng trong lịch sử.
- Kết thúc / hủy: driver; owner (khu thuộc sở hữu) và admin cũng có thể **complete** / **cancel**.
- `GET /trips`: driver xem của mình; owner theo khu; admin toàn hệ thống (có filter).
- Xe **bận** có thể suy ra: tồn tại trip `in_progress` (dùng cho map/dashboard sau).

### 6.3 Receipt (core)

- **Phạm vi giống trip:** Phiếu phải dùng **bãi đã gán** cho driver và (nếu có trạm) trạm thuộc owner quản lý; khi có `tripId` backend kiểm tra lại để tránh dữ liệu lệch.
- Nhập manual: weight (tấn), amount (VND), receipt_date, bill_code, notes
- **Bắt buộc** ít nhất một ảnh bill: URL (`imageUrls`) và/hoặc file đã upload (`imageFileIds` qua module Files)
- Harvest Area bắt buộc; Weighing Station **tùy** chuyến — nếu gắn `tripId`, hệ thống **tự lấy trạm từ trip** (phải khớp khu + driver + trip đang `in_progress`)
- Chụp ảnh bill (hỗ trợ nhiều ảnh)
- Submit → Pending
- Offline mode: lưu tạm → sync khi có mạng *(client; backend chưa mô tả chi tiết)*

### 6.4 Live tracking (bắt buộc)

- Khi Trip `in_progress` → app tự động chạy nền (background service)
- Gửi vị trí GPS định kỳ (10–15 giây khi di chuyển, 30–60 giây khi dừng)
- Không có nút tắt tracking
- Driver xem được vị trí của chính mình

### 6.5 History

- Xem danh sách receipt & trip
- Chi tiết receipt (dữ liệu + ảnh + trạng thái)

### 6.6 Profile

- Thông tin cá nhân, rating, tổng tấn đã vận chuyển

---

## 7. Feature list – Owner App

### 7.1 Dashboard realtime (core)

- Doanh thu / chi phí / lợi nhuận hôm nay & tháng
- Tổng tấn vận chuyển
- Số receipt Pending
- Số xe đang bận / đang rảnh
- Top driver hiệu quả

### 7.2 Live Driver Map (chức năng key)

- Bản đồ Google Maps hiển thị tất cả tài xế
- Marker: tên driver, trạng thái (đang bận / rảnh), khu xuất phát, trạm đích
- Lọc: xe đang bận / xe đang rảnh / tất cả
- Click marker xem chi tiết Trip
- Cập nhật realtime (mỗi 10–20 giây)

### 7.3 Receipt approval

- Danh sách Pending (filter theo ngày, khu, trạm, driver)
- Xem ảnh bill full size
- Approve hoặc Reject (bắt buộc nhập lý do khi reject)
- Sau approve → dữ liệu vào finance engine ngay lập tức

### 7.4 Harvest area management

- List / tạo / chi tiết / cập nhật / xoá mềm khu (API `harvest-areas`; **ghi/chỉnh/xoá:** admin + owner; **đọc:** thêm **driver** — chỉ các bãi đã được gán cho tài xế đó)
- Google Maps: latitude, longitude, `google_place_id`, v.v. khi có
- **Trạng thái vận hành bãi** (`status`): `inactive`, `preparing` (chuẩn bị/khảo sát), `active`, `paused`, `awaiting_renewal` (chờ chu kỳ mua cây tiếp), `completed`
- **Diện tích** (`area_hectares`, ha); **số tấn dự kiến** (`target_tons`)
- **Liên hệ phía chủ bãi / chủ đất** (hợp đồng cây — khác user *owner* trong hệ thống): tên, SĐT, email
- **Ngày mua/thuê cây tại bãi** (`site_purchase_date`) và **ghi chú** (ví dụ chu kỳ mua lại cây sau 2–3 năm)
- Tiến độ target tấn, current tons; lời/lỗ từng khu *(tổng hợp báo cáo có thể mở rộng sau)*

### 7.5 Weighing station management

- List / tạo / sửa / xoá mềm trạm (API `weighing-stations`; **ghi:** admin + owner; **đọc:** thêm **driver** — chỉ trạm có owner trùng owner quản lý tài xế; trạm không gắn owner — ví dụ tạo bởi admin — driver **không** thấy)
- Google Maps + `unit_price` (/tấn); giá vận chuyển receipt lấy theo trạm cân

### 7.6 Driver management

- List driver + performance (managed drivers qua `owner/drivers`)
- **Gán bãi cho từng tài xế:** `GET` / `PUT .../owner/drivers/:driverId/harvest-areas` — body `harvestAreaIds: []` (UUID) **thay thế toàn bộ** tập bãi được phép; mỗi bãi phải thuộc sở hữu owner đang gọi; driver phải là managed driver của owner đó
- Xem xe đang bận/rảnh

### 7.7 Report & alert

- Báo cáo theo ngày/tuần/tháng/khu/trạm/driver
- Alert: receipt pending quá lâu, xe dừng bất thường, xe đi sai hướng, driver có nhiều reject

---

## 8. Feature list – Admin Dashboard

- User management (CRUD + role)
- Receipt control & override approve/reject
- Audit log đầy đủ
- Master data: Harvest Areas, Weighing Stations
- System monitoring

---

## 9. Finance engine

- Chỉ tính khi receipt **Approved**
- `Revenue = weight × unit_price` (lấy từ Weighing Station)
- `Profit = Revenue − Cost` (driver cost + harvesting cost + other)
- Aggregation theo: khu, trạm cân, driver, thời gian

---

## 10. Anti-fraud & security

- Ảnh bill bắt buộc
- Approval workflow 2 lớp (Driver submit → Owner approve)
- Audit log: ai làm gì, lúc nào, sửa gì
- Detect duplicate `bill_code`
- Tracking realtime → phát hiện fake trip, đi sai lộ trình, dừng lâu bất thường
- Alert tự động cho Owner

---

## 11. Data model (tóm tắt các bảng chính)

- `users` + `driver_profiles` (driver có thể có `managed_by_owner_id` → owner quản lý)
- `harvest_areas` (Google Maps; `status` vận hành; `owner_id`; liên hệ chủ bãi + ngày mua cây + ghi chú — xem `KEO_Ops_database.md`)
- `driver_harvest_areas` (gán **driver** ↔ **bãi**; chỉ các bãi này driver được dùng trong trip/receipt và GET list/detail bãi)
- `weighing_stations` (có `unit_price` + Google Maps + `owner_id` tùy — driver chỉ dùng trạm có owner khớp owner quản lý)
- `trips` (`status`: planned / in_progress / completed / cancelled; tổng tấn/số phiếu approved gắn chuyến)
- `receipts` (status: pending / approved / rejected; `trip_id` tùy chọn, ràng buộc khớp chuyến khi có)
- `receipt_images`
- `finance_records`
- `vehicle_locations` (tracking realtime; trong một số tài liệu gọi là driver locations)
- `vehicles` (`owner_id`, biển số unique, `assigned_driver_id` unique nullable — owner gán tài xế managed)
- `vehicle_expenses` (chi phí theo xe: `repair` / `fuel` / `other`, số tiền, `occurred_at`)
- `audit_logs`
- `notifications`

*(Chi tiết schema: xem `KEO_Ops_database.md` và migration trong repo.)*

---

## 12. Đối chiếu triển khai backend (repo keo-be)

**Kết luận:** BRD mô tả **toàn bộ MVP**; backend keo-be đã có **nền API + DB** cho nhiều luồng cốt lõi; dashboard tổng hợp, map realtime và một số rule chống gian lận vẫn chủ yếu ở client hoặc chưa làm.

| Hạng mục trong BRD                         | Trạng thái trong keo-be (backend) |
| ------------------------------------------ | --------------------------------- |
| Đăng ký / auth                             | Email + password + JWT (boilerplate); **không** có login OTP số điện thoại |
| Harvest Area                               | **Có** CRUD + list/detail (admin/owner): `harvest-areas`. **Driver:** chỉ GET list/detail, phạm vi **bãi đã gán** + thuộc owner quản lý. Trạng thái: `inactive`, `preparing`, `active`, `paused`, `awaiting_renewal`, `completed`; `area_hectares`, `target_tons`; `site_*` |
| Gán driver ↔ bãi (owner)                   | **Có** `GET` / `PUT /owner/drivers/:driverId/harvest-areas` (body `harvestAreaIds`); bãi phải của owner; driver phải managed bởi owner |
| Weighing Station                           | **Có** CRUD + list/detail (admin + **owner**): `weighing-stations`. **Driver:** chỉ GET, phạm vi trạm có `owner_id` = owner quản lý tài xế |
| Receipt submit / approve / reject          | **Có** `POST/GET /receipts` + approve/reject; **submit (driver):** cùng rule phạm vi bãi gán + trạm/owner như trip; owner chỉ khu của mình; **bắt buộc** ít nhất một ảnh (`imageUrls` / `imageFileIds`) |
| Ảnh bill, nhiều ảnh                        | **Có** lưu `receipt_images`; upload qua `Files` + URL client |
| Finance khi approve                        | **Có** tạo `finance_records`, `revenue = weight × unit_price` (trạm active) |
| Trip                                       | **Có** `GET/POST /trips`, start/complete/cancel; **POST** yêu cầu driver có owner quản lý, **bãi đã gán**, trạm cùng owner và `active`; một trip `in_progress` / tài xế; complete/cancel: driver + owner (khu) + admin |
| Receipt gắn Trip                           | **Có** `tripId` khi submit: khớp driver + khu + trip `in_progress`; trạm cân **auto** theo trip; backend kiểm tra lại phạm vi bãi/trạm/owner |
| Trip `total_tons` / `total_receipts`       | **Có** cộng khi **approve** phiếu có `trip_id` |
| Live tracking / map                        | Bảng `vehicle_locations` có trong DB; **chưa** có API ghi/đọc vị trí theo BRD |
| Dashboard, báo cáo, alert                  | **Chưa** có API như mục 7.1, 7.7 |
| Audit log, notifications                   | Bảng có trong DB; **chưa** có service/API đầy đủ theo BRD |
| Duplicate `bill_code`, anti-fraud nâng cao | **Chưa** rule kiểm tra trùng |
| Admin user CRUD                            | **Có** (module Users, role admin) — một phần mục 8 |
| Vehicles + chi phí xe                     | **Có** `vehicles`: CRUD admin + owner (admin tạo cần `ownerId`); GET driver chỉ xe đang gán. **Gán xe:** `PUT /owner/drivers/:driverId/vehicle` (`vehicleId` hoặc `null`); `GET` cùng path trả **200** + xe hoặc **204** nếu chưa gán. **Chi phí:** `POST/GET/PATCH/DELETE` `/vehicles/:vehicleId/expenses` (admin + owner của xe). Đồng bộ `driver_profiles.vehicle_plate` khi gán / xoá mềm xe |
| Trip / receipt gắn `vehicle_id`            | **Chưa** (báo cáo theo xe có thể bổ sung sau) |

*Việc còn lại điển hình: API tracking, dashboard aggregate, audit/notifications, rule trùng `bill_code`, login OTP.*
