import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef } from 'react';
export function PhotoUploader({ photos, onChange }) {
    const [isUploading, setIsLoading] = useState(false);
    const fileInputRef = useRef(null);
    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
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
            }
            else {
                alert('上传失败: ' + (data.error || '未知错误'));
            }
        }
        catch (err) {
            console.error('Upload error:', err);
            alert('上传发生错误');
        }
        finally {
            setIsLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };
    const removePhoto = (index) => {
        const next = [...photos];
        next.splice(index, 1);
        onChange(next);
    };
    return (_jsx("div", { className: "photo-section", children: _jsxs("div", { className: "photo-grid", children: [photos.map((url, i) => (_jsxs("div", { className: "photo-thumb", children: [_jsx("img", { src: url, alt: "" }), _jsx("button", { type: "button", className: "photo-remove", onClick: () => removePhoto(i), title: "\u5220\u9664\u7167\u7247", children: "\u00D7" })] }, `${url}-${i}`))), _jsxs("label", { className: "photo-add-btn", children: [_jsx("input", { ref: fileInputRef, type: "file", accept: "image/*", onChange: handleFileChange, disabled: isUploading, style: { display: 'none' } }), isUploading ? '...' : '+ 添加照片'] })] }) }));
}
