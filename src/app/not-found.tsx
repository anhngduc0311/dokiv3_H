import Link from 'next/link';
import { Icon } from '../components/ui/icon';

export default function NotFound() {
  return (
    <div className="empty-state glass-panel" style={{ margin: '80px auto', maxWidth: 600 }}>
      <Icon name="book" style={{ width: 48, height: 48, marginBottom: 16 }} />
      <h1>Không tìm thấy trang</h1>
      <p>Đường dẫn này không tồn tại hoặc đã được chuyển sang địa chỉ mới.</p>
      <Link className="primary" href="/">
        Về trang chủ
      </Link>
    </div>
  );
}
