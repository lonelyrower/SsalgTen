interface ErrorBannerProps {
  error: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error }) => {
  return (
    <div className="mt-4 p-4 bg-[hsl(var(--status-error-50))] dark:bg-[hsl(var(--status-error-900)/0.2)] rounded-lg">
      <div className="flex items-center">
        <div className="text-[hsl(var(--status-error-500))] mr-2">⚠️</div>
        <div>
          <h3 className="font-medium text-[hsl(var(--status-error-900))] dark:text-[hsl(var(--status-error-100))]">
            Connection Error
          </h3>
          <p className="text-sm text-[hsl(var(--status-error-700))] dark:text-[hsl(var(--status-error-200))]">{error}</p>
        </div>
      </div>
    </div>
  );
};
