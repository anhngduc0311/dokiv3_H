# SEO tự động cho dokihentai.com

## Cấu trúc và vấn đề ban đầu

Dự án dùng Next.js 16.4.2 App Router, React, Neon PostgreSQL và cache Redis/bộ nhớ. `catalog-service.ts` kết hợp truyện nội bộ với nguồn MimiHentai; giao diện tương tác nằm trong Client Components.

Trước thay đổi, trang chủ, tìm kiếm, tác giả, chi tiết và chương đều gọi API trong effect. HTML ban đầu chủ yếu là trạng thái chờ; các trang dùng chung title/OG của layout, thiếu canonical riêng. Sitemap công khai và robots trỏ sang `dokitruyen.com`; sitemap API giới hạn 1.000 truyện, lấy domain từ request và bỏ qua lỗi DB. Phân trang chỉ có button, không có URL để crawler đi theo. Splash che nội dung, font tải từ Google trong trình duyệt và script đăng nhập được tải trên mọi trang.

## Metadata và dữ liệu server

- Các `page.tsx` là Server Components; file `*-client.tsx` giữ chức năng tương tác. Server truyền dữ liệu ban đầu để HTML có tên truyện, mô tả, ảnh và liên kết chương trước khi JavaScript chạy.
- `src/lib/seo.ts` thống nhất title, description, canonical, Open Graph, Twitter, URL và ngày hợp lệ. Domain chuẩn cố định là `https://dokihentai.com`, không lấy từ Host header.
- `seo-data.ts` dùng React cache để metadata và nội dung chia sẻ cùng kết quả truy vấn trong một lượt render.
- Trang truyện/chương lấy metadata từ dữ liệu thực; trang chủ/tác giả phân trang có canonical riêng. Biến thể tìm kiếm/bộ lọc và sắp xếp tác giả mang `noindex,follow` để hạn chế URL trùng lặp.
- Đăng nhập, đăng ký, đổi mật khẩu, theo dõi, lịch sử và admin có metadata riêng và `noindex,follow`. Robots cho phép crawler đọc các chỉ thị này; quyền truy cập vẫn do hệ thống auth xử lý.
- Nội dung không tồn tại gọi `notFound()`. ID chương tạm/alias chuyển hướng 308 tới ID chương thực. Lỗi upstream khi lấy truyện/chương được báo lỗi server thay vì trả một trang 404 sai; request upstream có timeout 10 giây.

## JSON-LD

Layout xuất WebSite và Organization. Từng trang xuất ComicSeries, Chapter, CollectionPage/ItemList và BreadcrumbList theo nội dung tương ứng. Dữ liệu JSON-LD escape ký tự `<` để không thể đóng thẻ script bằng dữ liệu nguồn. Không xuất AggregateRating vì source có điểm ước lượng, thiếu bằng chứng về số phiếu thực. Truyện được nguồn đánh dấu nội dung người lớn có metadata `rating=adult`.

Schema mô tả nội dung, không bảo đảm Google cấp rich results. Kiểm tra dữ liệu sau triển khai bằng [Schema Markup Validator](https://validator.schema.org/) và [Rich Results Test](https://search.google.com/test/rich-results).

## Sitemap và robots

- `/sitemap.xml`: sitemap index động.
- `/sitemap-static.xml`: trang chủ, tìm tác giả và tìm truyện.
- `/sitemaps/0.xml`, `/sitemaps/1.xml`, …: tối đa 5.000 URL/tệp, tự tăng số tệp theo dữ liệu DB.
- `/api/sitemap.xml`: chuyển hướng 308 về endpoint chuẩn.
- `/robots.txt`: một chính sách chung cho mọi bot; chặn API nhưng cho phép endpoint ảnh proxy và khai báo sitemap đúng domain.

Sitemap truy vấn chỉ đọc, lấy tất cả truyện công khai đã có trong bảng Mangas và chương công khai trong bảng Chapters. Loại truyện ẩn/bản nháp, chương khóa, chương có ngày xuất bản hoặc lịch hẹn trong tương lai. URL encode ID, escape XML; lastmod lấy từ dữ liệu thực, không gán ngày hôm nay hàng loạt. Endpoint lỗi DB trả 503, Retry-After và no-store, tránh cache sitemap rỗng như thể thành công. Phản hồi thành công có cache CDN một giờ và stale-while-revalidate.

Nguồn truyện từ xa hiện được ghi nhận vào Mangas khi đọc chi tiết qua cơ chế `rememberManga` có sẵn. Sitemap không thực hiện quét toàn bộ kho của bên thứ ba; chương từ xa chưa nằm trong Chapters được crawler khám phá qua liên kết danh sách chương trên trang truyện. Muốn sitemap bao phủ toàn bộ kho từ xa cần một job đồng bộ catalog/chapter metadata riêng; không chép chương không có nội dung vào Chapters vì điều đó sẽ làm reader hiểu nhầm là chương nội bộ.

## HTML, liên kết và hiệu năng

- H1 cho trang, heading của spotlight là H2; breadcrumb có landmark nav, thêm skip link và đích main.
- Phân trang danh sách dùng Link/href thật, giữ bộ lọc và rel prev/next. Phân trang bình luận/chương nội bộ giữ button phù hợp với trạng thái giao diện.
- Trang đọc có liên kết về truyện, trang chủ, chương trước và sau. Ảnh trang đọc xuất hiện ngay trong HTML, không chờ onLoad để được bỏ `visibility:hidden`.
- Font Be Vietnam Pro được next/font tự lưu trữ, display swap; bỏ splash và tải script Google chỉ trên trang đăng nhập/đăng ký.
- CoverImage dùng next/image với sizes, kích thước khung cố định và AVIF/WebP. Chỉ tối ưu các host HTTPS được khai báo trong `cover-images.ts`; host khác giữ cách tải trực tiếp. Nếu CDN yêu cầu hotlink headers và optimizer thất bại, thử ảnh trực tiếp trước khi dùng placeholder. Ảnh bìa chi tiết tải ưu tiên, ảnh thẻ truyện tải lazy.
- Tắt prefetch route hàng loạt trên các liên kết truyện/chương, giữ prefetch có chủ đích khi hover. Bỏ tự tải chương đầu khi người dùng mới mở chi tiết; giới hạn số ứng viên ảnh spotlight từ 40 xuống 8.
- Chương khóa/chưa xuất bản không được đưa vào HTML công khai hoặc nội dung reader.

API ảnh chương hiện chỉ trả URL, không có chiều rộng/chiều cao gốc. Chưa thể dành chính xác chiều cao cho mọi trang truyện trước khi ảnh tải; cần bổ sung kích thước thật ở nguồn hoặc bước nhập truyện để xử lý đầy đủ CLS của reader. Không khai báo kích thước giả cho các trang có tỷ lệ khác nhau.

## Kiểm tra và vận hành

Chạy `npm run test:seo`, `npx tsc --noEmit`, `npm run build`. Các test dùng adapter DB/catalog cô lập; không chạy migration/seed trên production. Test kiểm tra canonical, OG, chống chèn JSON-LD, sitemap phân tệp/lỗi/escape, robots và HTML truyện/chương/phân trang khi chưa chạy effect.

Sau deploy, gửi `https://dokihentai.com/sitemap.xml` vào Search Console. Dùng URL Inspection kiểm tra một truyện, một chương và trang phân trang. Đo Lighthouse/PageSpeed trên thiết bị di động và theo dõi dữ liệu thực trong Search Console: LCP ≤ 2,5 giây, INP ≤ 200 ms, CLS ≤ 0,1 tại phân vị 75. Build và test không thay thế phép đo Core Web Vitals trên production.

Tài liệu đã đối chiếu: các guide đi kèm trong `node_modules/next/dist/docs/`, [Metadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata), [JSON-LD](https://nextjs.org/docs/app/guides/json-ld), [Sitemap](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap), [Image](https://nextjs.org/docs/app/api-reference/components/image).
