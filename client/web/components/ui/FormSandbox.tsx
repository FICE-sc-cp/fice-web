'use client';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "./Input";
import { Select } from "./Select";
import { Textarea } from "./Textarea";
import { testSchema, TestFormValues } from "../../schemas/form-schema";

export const FormSandbox = () => {
    const {
        register,
        handleSubmit,
        formState: { errors, isValid },
    } = useForm<TestFormValues>({
        resolver: zodResolver(testSchema),
        mode: 'onChange',
    });

    const onSubmit = (data: TestFormValues) => console.log("Дані валідні:", data);

    return(
        <div className="p-6 border-2 border-dashed border-blue-200 rounded-3xl bh-blue-50/30">
            <h3 className="text-sm font-mono text-blue-500 mb-4 uppercase tracking-widest">
                Form Architecture Test Stand
            </h3>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                    label="Тест Інпута"
                    placeholder="Введіть текст..."
                    {...register('username')}
                    error={errors.username?.message}
                />
                <Select
                    label="Тест Селекта"
                    options={[
                        {value: "admin", label: "Адмін"},
                        {value: "user", label: "Користувач"}
                    ]}
                    {...register('role')}
                    error={errors.role?.message}
                />
                <Textarea
                    label="Тест Textarea"
                    placeholder="Розкажіть щось..."
                    {...register('bio')}
                    error={errors.bio?.message}
                />
                <button
                    type="submit"
                    disabled={!isValid}
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl disabled:bg-slate-300 transition-all"
                >
                    Перевірити валідацію
                </button>
            </form>
        </div>
    );
};