export function LoadingIndicator({ message = '回答を生成中...' }: { message?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 text-[#888] text-sm">
      <div className="w-5 h-5 border-2 border-[#333] border-t-[#4a9eff] rounded-full animate-spin shrink-0" />
      <span>{message}</span>
    </div>
  );
}
