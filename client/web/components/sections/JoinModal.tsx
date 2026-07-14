'use client';

import { useState, useRef } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { CloseIcon } from '@/components/ui/icons';
import { fice } from '@/lib/api';

interface JoinModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function JoinModal({ isOpen, onClose }: JoinModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries());

        try {
            await fice.submitApplication(data);

            formRef.current?.reset();
            onClose();
            alert('Заявка успішно відправлена!');
        } catch (error) {
            console.error('Помилка при відправці заявки:', error);
            alert('Сталася помилка. Спробуй пізніше.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-bg-soft p-6 shadow-xl sm:p-8 custom-scrollbar"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-fg transition-colors hover:bg-surface [&_svg]:h-5 [&_svg]:w-5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <CloseIcon />
                </button>

                <h2 className="mb-6 text-2xl font-bold text-fg text-center">
                    Подача заявки
                </h2>

                <form ref={formRef} className="flex flex-col gap-5" onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            label="ПІБ"
                            name="fullName"
                            placeholder="Шевченко Тарас Григорович"
                            required
                            disabled={isLoading}
                        />
                        <Input
                            label="Тег в Telegram"
                            name="telegramTag"
                            placeholder="@username"
                            required
                            disabled={isLoading}
                        />
                        <Input
                            label="Академічна група"
                            name="academicGroup"
                            placeholder="наприклад, ІП-51"
                            required
                            disabled={isLoading}
                        />
                        <Input
                            label="Контактний номер / Email"
                            name="contacts"
                            placeholder="+380... або email"
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <Select
                        label="Які департаменти тебе цікавлять?"
                        name="department"
                        required
                        disabled={isLoading}
                        options={[
                            { value: 'it', label: 'IT Департамент' },
                            { value: 'pr', label: 'PR Департамент' },
                            { value: 'event', label: 'Івент Департамент' },
                            { value: 'partners', label: 'Департамент партнерств' }
                        ]}
                    />

                    <Textarea
                        label="Мотивація"
                        name="motivation"
                        placeholder="Чому ти хочеш до нас приєднатись?"
                        rows={3}
                        required
                        disabled={isLoading}
                    />

                    <Textarea
                        label="Досвід"
                        name="experience"
                        placeholder="Розкажи про свій релевантний досвід (якщо є)"
                        rows={3}
                        disabled={isLoading}
                    />

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="mt-2 w-full rounded-lg bg-gradient-main px-4 py-3 font-bold text-black transition-opacity hover:opacity-80 disabled:opacity-60 disabled:cursor-wait"
                    >
                        {isLoading ? 'Відправка...' : 'Відправити заявку'}
                    </button>
                </form>
            </div>
        </div>
    );
}