export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>Không thể tải trang</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap" />
    <style>
      body { font: 14px/1.6 "Be Vietnam Pro", "Segoe UI", sans-serif; background: #f8f9fa; color: #101828; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; box-sizing: border-box; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.5rem; line-height: 2rem; font-weight: 600; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #6941c6; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Không thể tải trang</h1>
      <p>Đã xảy ra lỗi. Bạn có thể thử tải lại hoặc quay về trang chủ.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Thử lại</button>
        <a class="secondary" href="/">Về trang chủ</a>
      </div>
    </div>
  </body>
</html>`;
}
