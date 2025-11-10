interface ErrorBannerProps {
  error: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error }) => {
  return (
    <div className="mt-4 p-4 bg-[hsl(var(--error))]/10 rounded-lg">
      <div className="flex items-center">
        <div className="text-[hsl(var(--error))] mr-2">⚠️</div>
        <div>
          <h3 className="font-medium text-[hsl(var(--error))]">
            Connection Error
          </h3>
          <p className="text-sm text-[hsl(var(--error))]/80">{error}</p>
        </div>
      </div>
    </div>
  );
};
