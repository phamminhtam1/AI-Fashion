# HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG DOCKER & CLOUD LAB (AI FASHION - ÉLANE)

Tài liệu này cung cấp toàn bộ kiến trúc, quy trình triển khai và hướng dẫn vận hành hệ thống container hóa cho project **AI Fashion (ÉLANE)** theo mô hình phân tán nhiều máy ảo (Multi-VM Cloud Lab).

---

## 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG

### 1.1. Mô hình Mạng VirtualBox (Multi-VM Topology)

Hệ thống được thiết kế chạy trên 3 máy ảo Ubuntu Server và giao tiếp với máy Host Windows:

```
                  ┌─────────────────────────────────────────┐
                  │          Windows Host Machine           │
                  │              192.168.56.1               │
                  └────────────────────┬────────────────────┘
                                       │ (Host-only Network)
       ┌───────────────────────────────┼───────────────────────────────┐
       │                               │                               │
       ▼                               ▼                               ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
│     VM1 - APP SERVER    │ │     VM2 - DB SERVER     │ │ VM3 - MONITORING SERVER │
│      192.168.56.10      │ │      192.168.56.20      │ │      192.168.56.30      │
├─────────────────────────┤ ├─────────────────────────┤ ├─────────────────────────┤
│ • Nginx (Port 80, 8081) │ │ • PostgreSQL 16 Alpine  │ │ • Prometheus (Port 9090)│
│ • Storefront (Port 8090)│ │   (Port 5432)           │ │ • Grafana (Port 3000)   │
│ • Admin (Port 8081/8082)│ │ • Volume: elane_pg_data │ │ • Triển khai bước sau   │
│ • API / Hono (Port 3001)│ │ • Node Exporter (9100)  │ │                         │
│ • Node Exporter (9100)  │ │ • Postgres Exp (9187)   │ │                         │
│ • cAdvisor (8080)       │ │                         │ │                         │
└─────────────────────────┘ └─────────────────────────┘ └─────────────────────────┘
```

### 1.2. Cấu hình Card Mạng trên VirtualBox
Mỗi máy ảo cần cấu hình 2 Card mạng (Network Adapters):
1. **Adapter 1 - NAT**: Cho phép các máy ảo kết nối ra Internet để `apt update`, kéo Docker images, tải thư viện npm.
2. **Adapter 2 - Host-only Adapter** (thường là `vboxnet0` hoặc `VirtualBox Host-Only Ethernet Adapter`):
   - Cung cấp dải IP tĩnh `192.168.56.0/24`.
   - Cho phép các VM giao tiếp nội bộ với nhau với độ trễ thấp và cho phép máy Windows truy cập ứng dụng.

---

## 2. CẤU TRÚC FILE DOCKER & COMPOSE

```
AI-Fashion/
├── docker/
│   ├── api.Dockerfile             # Dev Dockerfile cho Backend
│   ├── api.prod.Dockerfile        # Production Dockerfile (Healthcheck, non-root, tối ưu runtime)
│   ├── storefront.Dockerfile      # Dev Dockerfile cho Storefront (Vite hot-reload)
│   ├── storefront.prod.Dockerfile # Production Multi-stage build (Nitro node-server)
│   ├── admin.Dockerfile           # Dev Dockerfile cho Admin (Vite hot-reload)
│   ├── admin.prod.Dockerfile      # Production Multi-stage build (Nitro node-server)
│   ├── api-entrypoint.sh          # Entrypoint thông minh: kiểm tra DB, chạy migrate/seed, start API
│   └── nginx/
│       ├── Dockerfile             # Nginx reverse proxy image
│       └── nginx.conf             # Định tuyến Storefront (80), Admin (8081), API (/api/), Media (/media/)
│
├── docker-compose.yml             # Base compose định nghĩa service và network chung
├── docker-compose.dev.yml         # Compose override cho môi trường Local Development (1 máy)
├── docker-compose.prod.yml        # Compose override cho VM1 App Server
├── docker-compose.db.yml          # Compose độc lập cho VM2 Database Server
│
├── .env.example                   # Tổng hợp giải thích các biến môi trường
├── .env.dev.example               # Template cấu hình Local Development
├── .env.prod.example              # Template cấu hình VM1 App Server
├── .env.db.example                # Template cấu hình VM2 Database Server
│
└── README_DEPLOYMENT.md           # Hướng dẫn chi tiết triển khai và vận hành
```

---

## 3. MÔI TRƯỜNG DEVELOPMENT (CHẠY TRÊN 1 MÁY LOCAL)

Phù hợp cho lập trình viên phát triển tính năng, kiểm thử hot-reload trên máy tính cá nhân. Tất cả các dịch vụ (PostgreSQL, Backend API, Storefront, Admin, ngrok) cùng chạy trên 1 Docker network.

### Bước 1: Chuẩn bị file cấu hình
```bash
cp .env.dev.example .env.dev
```

### Bước 2: Khởi chạy môi trường Dev
```bash
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml up --build -d
```

### Bước 3: Kiểm tra trạng thái
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml ps
```

### Địa chỉ truy cập Local:
- **Storefront**: `http://localhost:8090`
- **Admin Dashboard**: `http://localhost:8081` (Tài khoản mặc định: `admin@elane.local` / `ElaneAdmin1!`)
- **Backend API**: `http://localhost:3001` (Healthcheck: `http://localhost:3001/health`)
- **PostgreSQL**: `localhost:5432`

---

## 4. TRIỂN KHAI VM2 - DATABASE SERVER (192.168.56.20)

> **LƯU Ý QUAN TRỌNG:** Luôn triển khai VM2 (Database) trước khi khởi chạy VM1 (App Server) để backend có sẵn DB kết nối.

### Bước 1: Chuẩn bị trên VM2
Cài đặt Docker và Docker Compose trên Ubuntu:
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
newgrp docker
```

Tạo thư mục dự án và copy các file cần thiết vào VM2 (`docker-compose.db.yml` và `.env.db.example`):
```bash
mkdir -p ~/elane-db
cd ~/elane-db
```

### Bước 2: Cấu hình thông tin Database (.env.db)
```bash
cp .env.db.example .env.db
nano .env.db
```
Ví dụ nội dung file `.env.db`:
```env
POSTGRES_USER=elane_prod_user
POSTGRES_PASSWORD=MatKhauBaoMat2026!
POSTGRES_DB=elane_db
```

### Bước 3: Khởi chạy PostgreSQL Container
```bash
docker compose --env-file .env.db -f docker-compose.db.yml up -d
```

### Bước 4: Kiểm tra trạng thái Container
```bash
docker compose -f docker-compose.db.yml ps
```
Đảm bảo container hiển thị `healthy`:
```
NAME             IMAGE               STATUS                    PORTS
elane-postgres   postgres:16-alpine  Up 2 minutes (healthy)    0.0.0.0:5432->5432/tcp
```

Kiểm tra logs nếu cần:
```bash
docker logs elane-postgres
```

---

## 5. TRIỂN KHAI VM1 - APP SERVER (192.168.56.10)

Trên VM1 sẽ chạy Storefront, Admin, Backend API và Nginx Reverse Proxy. **Tuyệt đối không chạy PostgreSQL trên VM1**.

### Bước 1: Chuẩn bị mã nguồn trên VM1
```bash
sudo apt update && sudo apt install -y git docker.io docker-compose-v2
sudo usermod -aG docker $USER
newgrp docker

# Clone repo hoặc copy source code vào VM1
git clone <URL_REPO_CUA_BAN> AI-Fashion
cd AI-Fashion
```

### Bước 2: Kiểm tra kết nối từ VM1 sang VM2 (Port 5432)
Trước khi chạy container, xác minh VM1 có thể giao tiếp với PostgreSQL trên VM2:
```bash
# Cài netcat nếu chưa có
sudo apt install -y netcat-openbsd

# Kiểm tra port 5432 trên 192.168.56.20
nc -zv 192.168.56.20 5432
```
*Kết quả mong đợi:*
`Connection to 192.168.56.20 5432 port [tcp/postgresql] succeeded!`

### Bước 3: Thiết lập cấu hình Production (.env.prod)
```bash
cp .env.prod.example .env.prod
nano .env.prod
```

Điều chỉnh chính xác các biến quan trọng:
```env
# Trỏ đến Database trên VM2 với mật khẩu đã đặt ở VM2:
POSTGRES_USER=elane_prod_user
POSTGRES_PASSWORD=MatKhauBaoMat2026!
POSTGRES_DB=elane_db
DATABASE_URL=postgres://elane_prod_user:MatKhauBaoMat2026!@192.168.56.20:5432/elane_db

# Secret bảo mật session
SESSION_SECRET=c68a4e8d35f79b02a1d48c9032beff67149023ab1

# IP của các máy trong Cloud Lab
APP_SERVER_IP=192.168.56.10
DB_SERVER_IP=192.168.56.20

# Cho phép CORS từ các máy trong phòng Lab
STOREFRONT_ORIGIN=http://192.168.56.10
ADMIN_ORIGIN=http://192.168.56.10:8081
CORS_ORIGINS=http://192.168.56.10,http://192.168.56.10:8081,http://192.168.56.10:8090,http://192.168.56.10:3001

# Để trống VITE_API_URL khi dùng Nginx Gateway (relative path /api)
VITE_API_URL=
```

### Bước 4: Khởi chạy Production Containers
```bash
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Quá trình khởi chạy sẽ tự động thực hiện:
1. Docker build multi-stage cho Storefront & Admin thành các bundle Nitro SSR siêu nhẹ.
2. Container `api` khởi động, `docker/api-entrypoint.sh` chờ database trên `192.168.56.20:5432` sẵn sàng.
3. Tự động chạy `npm run db:migrate` và `npm run db:seed`.
4. Khởi chạy Nginx reverse proxy tại Port 80 và Port 8081.

### Bước 5: Kiểm tra trạng thái và logs
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```
Tất cả các container (`elane-nginx`, `elane-storefront`, `elane-admin`, `elane-api`) đều phải ở trạng thái `Up (healthy)`.

Xem log khởi động API:
```bash
docker logs -f elane-api
```

---

## 6. KIỂM THỬ TỪ TRÌNH DUYỆT MÁY WINDOWS (HOST)

Mở trình duyệt trên máy Windows Host (IP: `192.168.56.1`):

1. **Storefront (Khách hàng)**:
   - URL: `http://192.168.56.10`
   - Gọi API tương đối qua Nginx Gateway: `http://192.168.56.10/api/v1/products`
2. **Admin Dashboard (Quản trị)**:
   - URL: `http://192.168.56.10:8081`
   - Tài khoản đăng nhập: `admin@elane.local`
   - Mật khẩu: `ElaneAdmin1!`
3. **Backend API trực tiếp (Kiểm tra)**:
   - URL: `http://192.168.56.10:3001/health` (Trả về: `{"ok":true}`)
4. **Nginx Healthcheck**:
   - URL: `http://192.168.56.10/health` (Trả về: `{"status":"UP","service":"nginx-storefront"}`)
   - URL: `http://192.168.56.10:8081/health` (Trả về: `{"status":"UP","service":"nginx-admin"}`)

---

## 7. CHUẨN BỊ CHO MONITORING (VM3: 192.168.56.30)

Hệ thống đã được thiết kế sẵn sàng các port và tài nguyên để tích hợp giám sát với Prometheus & Grafana mà không xảy ra xung đột:

| Máy ảo | Service giám sát dự kiến | Port | Trạng thái cổng trên VM |
| :--- | :--- | :--- | :--- |
| **VM1 (App Server)** | **Node Exporter** (Giám sát CPU/RAM/Disk Host) | `9100` | Sẵn sàng (không trùng) |
| **VM1 (App Server)** | **cAdvisor** (Giám sát Container metrics) | `8080` | Sẵn sàng (Storefront chạy 8090) |
| **VM2 (DB Server)** | **Node Exporter** (Giám sát VM2 Host) | `9100` | Sẵn sàng (không trùng) |
| **VM2 (DB Server)** | **PostgreSQL Exporter** (Metrics Database) | `9187` | Sẵn sàng (không trùng) |
| **VM3 (Monitoring)**| **Prometheus** (Thu thập & lưu trữ metrics) | `9090` | Sẵn sàng trên VM3 |
| **VM3 (Monitoring)**| **Grafana** (Trực quan hóa Dashboard) | `3000` | Sẵn sàng trên VM3 |

*Lưu ý:* Khi triển khai VM3, chỉ cần cài đặt file cấu hình `prometheus.yml` cào dữ liệu từ `192.168.56.10:9100`, `192.168.56.10:8080`, `192.168.56.20:9100`, và `192.168.56.20:9187`.

---

## 8. CÁC LỆNH VẬN HÀNH DOCKER THƯỜNG DÙNG

### Xem danh sách container và trạng thái health
```bash
# Trên VM1:
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Trên VM2:
docker compose -f docker-compose.db.yml ps
```

### Xem logs thời gian thực
```bash
# Tất cả services:
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Riêng backend API:
docker logs -f elane-api

# Riêng Nginx:
docker logs -f elane-nginx
```

### Truy cập shell bên trong container
```bash
# Vào shell container API:
docker exec -it elane-api sh

# Vào shell container PostgreSQL (VM2):
docker exec -it elane-postgres psql -U elane_prod_user -d elane_db
```

### Khởi động lại hoặc dừng hệ thống
```bash
# Khởi động lại service cụ thể (ví dụ API):
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart api

# Dừng toàn bộ hệ thống (giữ nguyên volumes):
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# Xem mức tiêu hao tài nguyên (CPU, RAM):
docker stats
```

---

## 9. XỬ LÝ SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

### 1. API không kết nối được Database VM2
- **Triệu chứng:** Container `elane-api` liên tục log `Waiting for DB (postgres://...:****@192.168.56.20:5432/...)`.
- **Nguyên nhân & Cách khắc phục:**
  1. Kiểm tra trên VM2 xem PostgreSQL container có đang chạy không: `docker ps`.
  2. Kiểm tra tường lửa trên VM2:
     ```bash
     sudo ufw status
     # Nếu đang bật, cho phép port 5432 từ dải mạng Lab:
     sudo ufw allow from 192.168.56.0/24 to any port 5432
     ```
  3. Từ VM1, chạy lệnh test kết nối: `nc -zv 192.168.56.20 5432`.
  4. Đảm bảo username, password, tên database trong `.env.prod` khớp 100% với `.env.db` trên VM2.

### 2. Frontend báo lỗi Network / Không gọi được API
- **Triệu chứng:** Giao diện tải được nhưng danh sách sản phẩm trống, console báo lỗi `Failed to fetch`.
- **Nguyên nhân & Cách khắc phục:**
  1. Trong môi trường có Nginx, `VITE_API_URL` nên để trống để frontend tự động gửi request dạng relative path `/api/v1/...` cùng origin với trang web, tránh triệt để lỗi Mixed Content hay CORS.
  2. Kiểm tra logs Nginx: `docker logs elane-nginx` xem request `/api/` có chuyển tiếp thành công đến `api:3001` không.

### 3. Lỗi CORS (Cross-Origin Request Blocked)
- **Triệu chứng:** Browser console báo `Access-Control-Allow-Origin header is missing`.
- **Khắc phục:** Hệ thống backend Hono đã được tối ưu cho phép toàn bộ dải IP `http://192.168.56.*`. Nếu truy cập qua IP khác (ví dụ qua mạng Wi-Fi khác), hãy cập nhật biến `CORS_ORIGINS` trong `.env.prod` trên VM1 và restart lại container:
  ```bash
  docker compose -f docker-compose.yml -f docker-compose.prod.yml restart api
  ```

### 4. Dữ liệu PostgreSQL bị mất khi tạo lại container
- **Nguyên nhân:** Không sử dụng Docker Named Volume hoặc xóa nhầm volume.
- **Khắc phục:** File `docker-compose.db.yml` đã được chỉ định named volume `elane_pg_data`. Khi chạy `docker compose down`, volume không bị xóa. Chỉ mất dữ liệu nếu bạn cố ý chạy `docker compose down -v`.

### 5. Xung đột cổng (Port Conflict)
- Nếu port 80 hoặc 8081 đã bị chiếm bởi Apache/Nginx cài trực tiếp trên máy chủ Ubuntu:
  ```bash
  sudo systemctl stop apache2 nginx
  sudo systemctl disable apache2 nginx
  ```
  Sau đó khởi động lại Docker compose.
