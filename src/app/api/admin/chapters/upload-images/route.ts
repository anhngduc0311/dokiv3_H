import { NextResponse } from 'next/server';
import { getUserFromRequest, requireAdmin } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user || !requireAdmin(user)) {
      return NextResponse.json({ message: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ message: 'Không có file ảnh nào được gửi.' }, { status: 400 });
    }

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const uploadRelDir = `/uploads/chapters/${todayStr}`;
    const uploadFullDir = path.join(process.cwd(), 'public', 'uploads', 'chapters', todayStr);

    let canWriteToDisk = true;
    try {
      if (!fs.existsSync(uploadFullDir)) {
        fs.mkdirSync(uploadFullDir, { recursive: true });
      }
    } catch {
      canWriteToDisk = false;
    }

    const uploadedUrls: string[] = [];

    for (const file of files) {
      if (!file || typeof file.arrayBuffer !== 'function') continue;
      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.length === 0) continue;

      let ext = path.extname(file.name || '').toLowerCase();
      if (!ext || ext.length > 5) {
        if (file.type === 'image/png') ext = '.png';
        else if (file.type === 'image/webp') ext = '.webp';
        else if (file.type === 'image/gif') ext = '.gif';
        else ext = '.jpg';
      }

      const fileName = `${uuidv4()}${ext}`;

      if (canWriteToDisk) {
        try {
          const filePath = path.join(uploadFullDir, fileName);
          fs.writeFileSync(filePath, buffer);
          uploadedUrls.push(`${uploadRelDir}/${fileName}`);
          continue;
        } catch {
          // If write fails, fall back to data url
        }
      }

      // Fallback for read-only serverless environments
      const mime = file.type || 'image/jpeg';
      const base64 = buffer.toString('base64');
      uploadedUrls.push(`data:${mime};base64,${base64}`);
    }

    return NextResponse.json({ urls: uploadedUrls });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi tải lên ảnh.' }, { status: 500 });
  }
}
