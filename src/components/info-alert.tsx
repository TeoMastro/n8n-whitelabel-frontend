'use client';

import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle, X, AlertCircle, AlertTriangle } from 'lucide-react';

interface InfoAlertProps {
  message: string;
  type?: 'success' | 'error' | 'warning';
}

export function InfoAlert({ message, type = 'success' }: InfoAlertProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const getAlertStyles = () => {
    switch (type) {
      case 'success':
        return {
          alertClasses: 'border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800',
          iconClasses: 'text-green-600 dark:text-green-400',
          textClasses: 'text-green-800 dark:text-green-200',
          buttonHoverClasses: 'hover:bg-green-100 dark:hover:bg-green-900',
          icon: CheckCircle,
        };
      case 'error':
        return {
          alertClasses: 'border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800',
          iconClasses: 'text-red-600 dark:text-red-400',
          textClasses: 'text-red-800 dark:text-red-200',
          buttonHoverClasses: 'hover:bg-red-100 dark:hover:bg-red-900',
          icon: AlertCircle,
        };
      case 'warning':
        return {
          alertClasses: 'border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800',
          iconClasses: 'text-orange-600 dark:text-orange-400',
          textClasses: 'text-orange-800 dark:text-orange-200',
          buttonHoverClasses: 'hover:bg-orange-100 dark:hover:bg-orange-900',
          icon: AlertTriangle,
        };
      default:
        return {
          alertClasses: 'border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800',
          iconClasses: 'text-green-600 dark:text-green-400',
          textClasses: 'text-green-800 dark:text-green-200',
          buttonHoverClasses: 'hover:bg-green-100 dark:hover:bg-green-900',
          icon: CheckCircle,
        };
    }
  };

  const {
    alertClasses,
    iconClasses,
    textClasses,
    buttonHoverClasses,
    icon: IconComponent,
  } = getAlertStyles();

  return (
    <Alert className={`${alertClasses} relative`}>
      <IconComponent className={`h-4 w-4 ${iconClasses}`} />
      <AlertDescription className={`${textClasses} pr-8`}>
        {message}
      </AlertDescription>
      <Button
        variant="ghost"
        size="sm"
        className={`absolute top-2 right-2 h-6 w-6 p-0 ${buttonHoverClasses}`}
        onClick={() => setIsVisible(false)}
      >
        <X className={`h-4 w-4 ${iconClasses}`} />
      </Button>
    </Alert>
  );
}
