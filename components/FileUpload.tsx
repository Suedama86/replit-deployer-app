import React, { useCallback, useState } from 'react';
import { UploadIcon } from './icons/Icons';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        if (files[0].type === 'application/zip' || files[0].name.endsWith('.zip')) {
          onFileSelect(files[0]);
        } else {
          alert('Please upload a .zip file.');
        }
      }
    },
    [onFileSelect]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  return (
    <div
      className={`relative w-full p-8 border-2 border-dashed rounded-lg transition-all duration-300 ease-in-out text-center cursor-pointer
        ${isDragging ? 'border-cyan-400 bg-gray-700/50 scale-105' : 'border-gray-600 bg-gray-800 hover:border-cyan-500'}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => document.getElementById('fileInput')?.click()}
    >
      <input
        type="file"
        id="fileInput"
        className="hidden"
        accept=".zip"
        onChange={handleFileChange}
      />
      <div className="flex flex-col items-center">
        <UploadIcon className="w-12 h-12 text-gray-500 mb-4" />
        <p className="text-xl font-semibold text-white">
          <span className="text-cyan-400">Click to upload</span> or drag and drop
        </p>
        <p className="text-gray-400 mt-1">
          your Replit project ZIP file here
        </p>
      </div>
    </div>
  );
};