export function LoadingIndicator({ message = '回答を生成中...' }: { message?: string }) {
  return (
    <div className="loading-indicator">
      <div className="spinner" />
      <span>{message}</span>
    </div>
  );
}
