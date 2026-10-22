import { clsx } from 'clsx';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullscreen?: boolean;
  label?: string;
}

export default function LoadingSpinner({ size = 'md', fullscreen, label }: LoadingSpinnerProps) {
  const sizes = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-[3px]',
  };

  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <div
        className={clsx(
          sizes[size],
          'rounded-full border-surface-600 border-t-brand-400 animate-spin'
        )}
      />
      {label && <p className="text-sm text-surface-400">{label}</p>}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-surface-950">
        {spinner}
      </div>
    );
  }

  return spinner;
}
