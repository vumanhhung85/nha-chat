# Nhà Mình — giao diện

App nhắn tin gia đình (PWA): nhóm chung + chat riêng, ảnh/tệp/ghi âm, giao bài tập, báo Telegram cho bố mẹ.

- Web: `https://nha.vmh.io.vn` (GitHub Pages, nhánh `main`, thư mục gốc)
- API: Cloudflare Worker `nha-chat-api` — code ở repo riêng (private) `nha-chat-worker`
- Địa chỉ API khai ở `DEFAULT_API` trong `index.html`
- Tin mới đến tức thì qua WebSocket (có đồng bộ định kỳ dự phòng); thông báo đẩy khi tắt app: Cài đặt → 🔔 Thông báo (Android, iPad iPadOS 16.4+ sau khi Thêm vào MH chính; iPad Air 2 không hỗ trợ)

Viết theo chuẩn Safari 15 (iPad Air 2): không dùng `.at()`, `structuredClone`, `<dialog>`, `:has()`, `dvh`, `crypto.randomUUID`.

Khi sửa cả Worker và giao diện: **Worker deploy xong trước**, rồi mới cập nhật `index.html`.
