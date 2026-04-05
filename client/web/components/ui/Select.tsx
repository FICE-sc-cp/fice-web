import { forwardRef, SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>{
    label: string;
    options: { value: string; label: string;} [];
    error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ label, options, error, ...props}, ref)=>{
        return(
            <div className="flex flex-col gap-1.5 w-full text-left">
                <label className="text-sm font-semibold text-slate-700">{label}</label>
                <select 
                    ref={ref}
                    {...props}
                    className={`px-4 py-3 rounded-xl border bg-white transition-all outline-none appearance-none
                        ${error
                            ? 'border-red-500 focus:ring-red-100'
                            : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50'}`}
                >
                    <option value="" disabled>Оберіть варіант...</option>
                    {options.map((opt) =>(
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
            </div>
        );
    }
);

Select.displayName = "Select";