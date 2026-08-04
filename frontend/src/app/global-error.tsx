"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="vi">
      <body className="flex min-h-screen items-center justify-center bg-[#f5f7fa] p-6 font-sans">
        <div className="w-full max-w-md rounded-2xl border border-[#e4e9f0] bg-white p-8 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-2xl font-extrabold text-red-600">
            !
          </span>
          <h1 className="mt-4 text-xl font-extrabold text-[#1c2733]">Có lỗi xảy ra</h1>
          <p className="mt-2 text-sm text-[#64748b]">Hệ thống gặp sự cố ngoài dự kiến. Vui lòng thử lại.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex cursor-pointer items-center justify-center rounded-lg bg-[#00748b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#066073]"
          >
            Thử lại
          </button>
        </div>
      </body>
    </html>
  );
}
