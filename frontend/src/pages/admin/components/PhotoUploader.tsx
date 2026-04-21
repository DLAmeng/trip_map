import { useState, useRef } from 'react';

interface PhotoUploaderProps {
  photos: string[];
  onChange: (photos: string[]) => void;
}

export function PhotoUploader({ photos, onChange }: PhotoUploaderProps) {
  const [isUploading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/photos/upload', {
        method: 'POST',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      const data = await response.json();
      if (data.ok && data.url) {
        onChange([...photos, data.url]);
      } else {
        alert('上传失败: ' + (data.error || '未知错误'));
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('上传发生错误');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removePhoto = (index: number) => {
    const next = [...photos];
    next.splice(index, 1);
    onChange(next);
  };

  return (
    <div className="photo-section">
      <div className="photo-grid">
        {photos.map((url, i) => (
          <div key={`${url}-${i}`} className="photo-thumb">
            <img src={url} alt="" />
            <button
              type="button"
              className="photo-remove"
              onClick={() => removePhoto(i)}
              title="删除照片"
            >
              ×
            </button>
          </div>
        ))}
        
        <label className="photo-add-btn">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isUploading}
            style={{ display: 'none' }}
          />
          {isUploading ? '...' : '+ 添加照片'}
        </label>
      </div>
    </div>
  );
}
