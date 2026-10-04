export function ageOf(birthDate: Date | null | undefined): {
  age: number | null;
  isAdult: boolean | null;
} {
  if (!birthDate) return { age: null, isAdult: null };
  const age = Math.abs(
    new Date(Date.now() - new Date(birthDate).getTime()).getUTCFullYear() -
      1970,
  );
  return { age, isAdult: age >= 18 };
}
