import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement>{
    label: string;
    error?: string;
    className?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, className, ...props }, ref )=>{
        return(
            <div className="flex flex-col gap-1.5 w-full">
                <label className="text-sm font-semibold text-slate-700">
                    {label}
                </label>
                <input 
                    ref={ref} 
                    {...props} 
                    className={cn("px-4 py-3 rounded-xl border transition-all outline-none" , 
                        error
                            ? 'border-red-500 focus:ring-red-100'
                            : 'border-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-50',
                        className
                        )} 
                />

                {error && (
                    <span className="text-xs text-red-500 font-medium">
                        {error}
                    </span>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';