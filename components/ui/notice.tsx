type NoticeProps = {
  message?: string | null;
  type?: "error" | "info";
};

export function Notice({ message, type = "info" }: NoticeProps) {
  if (!message) {
    return null;
  }

  return <div className={`notice notice-${type}`}>{message}</div>;
}
