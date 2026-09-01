export default function Card({ className = "", children, ...props }) {
  return (
    <div className={`glass-panel p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}
