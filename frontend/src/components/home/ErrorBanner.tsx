interface ErrorBannerProps {
  error: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error }) => {
  return (
    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
      <div className="flex items-center">
        <div className="text-red-500 mr-2">⚠️</div>
        <div>
          <h3 className="font-medium text-red-900 dark:text-red-100">
            Connection Error
          </h3>
          <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
        </div>
      </div>
    </div>
  );
};
