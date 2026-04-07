import { forwardRef, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>{
    label: string;
    error?: string;
    className?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ label, error, className, ...props }, ref)=>{
        return(
            <div className="flex flex-col gap-1.5 w-full text-left">
                <label className="text-sm font-semibold text-slate-700">{label}</label>
                <textarea 
                    ref={ref}
                    {...props}
                    className={cn( "px-4 py-3 rounded-xl border transition-all outline-none min-h-[120px] resize-y",
                        error
                            ? 'border-red-500 focus:ring-red-100'
                            : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50',
                        className
                        )}
                />
                {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
            </div>
        );
    }
);

Textarea.displayName = 'Textarea';