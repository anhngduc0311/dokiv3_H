# DokiTruyen Next.js

Ứng dụng Next.js App Router dùng Neon PostgreSQL và Redis/Upstash (tùy chọn), không cần chạy backend C# để dùng catalog.

## Chạy local

Cấu hình DATABASE_URL trong .env.local, sau đó chạy trong thư mục frontend-next:

```powershell
npm install
npm run dev
```

## Nguồn truyện

- MangaDex: duyệt, tìm kiếm và phân trang kho truyện có bản dịch tiếng Việt/tiếng Anh.
- TruyenGG: tải danh sách, tìm tên truyện, thể loại, quốc gia, tình trạng, truyện mới/cập nhật và truyện yêu thích; hỗ trợ chi tiết, danh sách chương, ảnh đọc và điều hướng chương.
- Trang chủ hiển thị cả hai nguồn. Trong trang khám phá, mở bộ lọc Nguồn truyện để xem riêng MangaDex hoặc TruyenGG.
- Các bản từ hai nguồn có ID riêng và có thể trùng tên. Tổng catalog là số bản truyện của các nguồn, không phải số tác phẩm duy nhất.
- TruyenGG không cung cấp các bộ lọc tác giả, năm, đánh giá, số chương hoặc A-Z qua adapter này; các bộ lọc đó dùng MangaDex. Khi chọn riêng TruyenGG, giao diện tắt các lựa chọn không được hỗ trợ.

Đường dẫn TruyenGG được lưu trong bảng CatalogSourceRefs (tự tạo khi chạy) để mở lại link sau khi khởi động lại hoặc chuyển instance. Giữ DATABASE_URL nhất quán giữa các lần chạy. HTML nguồn được cache 5 phút; một nguồn tạm lỗi không chặn nguồn còn lại. Không cần tải toàn bộ ảnh chương vào database.

## Kiểm tra

Chạy từ thư mục gốc repository:

```powershell
node --experimental-strip-types tests/next-catalog.mjs
node --experimental-strip-types tests/truyengg-catalog.mjs
```

Build trong thư mục frontend-next bằng `npm run build`.

## Bổ sung chương TruyenGG cho truyện MangaDex

Khi mở danh sách chương tiếng Việt của truyện MangaDex, ứng dụng tìm bộ tương ứng trên TruyenGG bằng tên chính/tên khác, kiểm tra thông tin tác giả và quốc gia khi có. Nếu chỉ có một bộ khớp rõ ràng, ứng dụng ghi liên kết vào bảng MangaChapterSources và bổ sung số chương còn thiếu. Các chương MangaDex đã có giữ nguyên ID và được ưu tiên ở số chương trùng nhau; chương bổ sung có nhãn TruyenGG.

ID chương bổ sung được lưu riêng trong CatalogSourceRefs, giữ nguyên mangaId MangaDex để theo dõi, lịch sử và đường dẫn về truyện vẫn thống nhất. Điều hướng đọc dùng cùng danh sách đã ghép nên chuyển được giữa hai nguồn. Nguồn bổ sung tạm lỗi hoặc kết quả ghép mơ hồ sẽ giữ danh sách MangaDex hiện có; cache danh sách ghép hết hạn sau 5 phút. Chương tiếng Anh không được trộn với chương tiếng Việt.

Kiểm thử bổ sung: `node --experimental-strip-types tests/chapter-source-sync.mjs`.
