type ProgressRingProps = {
  value: number;
  size?: number;
  label?: string;
};

export default function ProgressRing({ value, size = 72, label }: ProgressRingProps) {
  const percent = Math.max(0, Math.min(100, value));
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (percent / 100) * circumference;

  return (
    <svg className="progress-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius} className="progress-ring__track" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        className="progress-ring__value"
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
      />
      {label && <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="progress-ring__label">{label}</text>}
    </svg>
  );
}