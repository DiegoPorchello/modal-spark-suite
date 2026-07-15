"use client";

import { useEffect, useState } from "react";

interface ClientTimeProps {
  timestamp: number | Date;
  options?: Intl.DateTimeFormatOptions;
  locale?: string;
  className?: string;
  fallback?: string;
}

export function ClientTime({
  timestamp,
  options = { hour: "2-digit", minute: "2-digit", second: "2-digit" },
  locale = "pt-BR",
  className = "",
  fallback = "—",
}: ClientTimeProps) {
  const [time, setTime] = useState<string>(fallback);

  useEffect(() => {
    const update = () => {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      if (!isNaN(date.getTime())) {
        setTime(date.toLocaleTimeString(locale, options));
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timestamp, options, locale]);

  return <span className={className}>{time}</span>;
}
