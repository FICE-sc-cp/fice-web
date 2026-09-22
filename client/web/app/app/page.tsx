'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import {
  fice,
  mediaUrl,
  type BotUserProfile,
  type CheckInItem,
  type EventItem,
  type MyEventRegistration,
  type PublicVoting,
  type RegistrationPayment,
} from '@/lib/api';
import { renderRichInline } from '@/lib/richText';
import { useTelegram } from '@/lib/telegram';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Glow } from '@/components/ui/Glow';
import { cn } from '@/lib/utils';

function pluralizeEvents(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${count} заходів`;
  if (mod10 === 1) return `${count} захід`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} заходи`;
  return `${count} заходів`;
}

function MiniAppContent() {
  const searchParams = useSearchParams();
  const {
    ready,
    isTelegram,
    initData,
    user,
    startParam,
    haptic,
    hapticNotify,
    showBackButton,
    hideBackButton,
  } = useTelegram();

  // Navigation
  const [activeTab, setActiveTab] = useState<'events' | 'my-events' | 'profile'>('events');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeVotingId, setActiveVotingId] = useState<string | null>(null);

  // Profile
  const [profile, setProfile] = useState<BotUserProfile | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileGroup, setProfileGroup] = useState('');
  const [profileBirthDate, setProfileBirthDate] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileSavedMsg, setProfileSavedMsg] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);

  // Events & Registrations
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [eventVotings, setEventVotings] = useState<
    { id: string; title: string; status: string; totalVotes: number }[]
  >([]);
  const [myRegistrations, setMyRegistrations] = useState<MyEventRegistration[]>([]);
  const [isLoadingMy, setIsLoadingMy] = useState(false);

  // Voting
  const [votingData, setVotingData] = useState<PublicVoting | null>(null);
  const [isLoadingVoting, setIsLoadingVoting] = useState(false);
  const [votingError, setVotingError] = useState<string | null>(null);
  const [isVotingSubmitting, setIsVotingSubmitting] = useState(false);

  // Organizer Check-In State
  const [canCheckIn, setCanCheckIn] = useState(false);
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [checkInList, setCheckInList] = useState<CheckInItem[]>([]);
  const [serverCheckInStats, setServerCheckInStats] = useState<{
    total: number;
    attendedCount: number;
  } | null>(null);
  const [isLoadingCheckIn, setIsLoadingCheckIn] = useState(false);
  const [checkInSearch, setCheckInSearch] = useState('');
  const [checkInFilter, setCheckInFilter] = useState<'ALL' | 'UNATTENDED' | 'ATTENDED'>('ALL');
  const [togglingCheckInId, setTogglingCheckInId] = useState<string | null>(null);

  const checkInTotal = serverCheckInStats?.total ?? checkInList.length;
  const checkInAttendedCount = useMemo(() => {
    return checkInList.length > 0
      ? checkInList.filter((i) => i.attended).length
      : (serverCheckInStats?.attendedCount ?? 0);
  }, [checkInList, serverCheckInStats]);
  const checkInUnattendedCount = Math.max(0, checkInTotal - checkInAttendedCount);
  const checkInPercentage =
    checkInTotal > 0 ? Math.round((checkInAttendedCount / checkInTotal) * 100) : 0;

  // Costume Submission State
  const [costumeModalOpen, setCostumeModalOpen] = useState(false);
  const [costumeName, setCostumeName] = useState('');
  const [costumeDesc, setCostumeDesc] = useState('');
  const [costumePhotoUrl, setCostumePhotoUrl] = useState<string | null>(null);
  const [costumeUploading, setCostumeUploading] = useState(false);
  const [costumeSubmitting, setCostumeSubmitting] = useState(false);
  const [costumeError, setCostumeError] = useState<string | null>(null);
  const [costumeSuccessMsg, setCostumeSuccessMsg] = useState<string | null>(null);

  // Registration Form State
  const [regFullName, setRegFullName] = useState('');
  const [regGroup, setRegGroup] = useState('');
  const [regTelegram, setRegTelegram] = useState('');
  const [regBirthDate, setRegBirthDate] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPayment, setRegPayment] = useState<'' | RegistrationPayment>('');
  const [regReceiptUrl, setRegReceiptUrl] = useState<string | null>(null);
  const [regUploading, setRegUploading] = useState(false);
  const [regAnswers, setRegAnswers] = useState<Record<string, string>>({});
  const [regSaveProfile, setRegSaveProfile] = useState(true);
  const [regConsent, setRegConsent] = useState(false);
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});
  const [regSubmitError, setRegSubmitError] = useState<string | null>(null);
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);
  const [cancellingRegId, setCancellingRegId] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);

  // Load events
  useEffect(() => {
    setIsLoadingEvents(true);
    fice
      .events(30, 1, false)
      .then((res) => {
        setEvents(res.items);
      })
      .catch(() => {})
      .finally(() => setIsLoadingEvents(false));
  }, []);

  // Handle deep link / start parameters
  useEffect(() => {
    const param = startParam || searchParams.get('startapp');
    if (!param) return;

    if (param.startsWith('event_')) {
      const id = param.replace('event_', '');
      setSelectedEventId(id);
      setActiveTab('events');
    } else if (param.startsWith('vote_')) {
      const id = param.replace('vote_', '');
      setActiveVotingId(id);
    }
  }, [startParam, searchParams]);
 
  // Handle Telegram native BackButton
  useEffect(() => {
    if (selectedEventId || activeVotingId || checkInModalOpen || costumeModalOpen) {
      showBackButton(() => {
        if (costumeModalOpen) {
          setCostumeModalOpen(false);
        } else if (checkInModalOpen) {
          setCheckInModalOpen(false);
        } else if (activeVotingId) {
          setActiveVotingId(null);
        } else if (selectedEventId) {
          setSelectedEventId(null);
          setRegSuccess(false);
        }
      });
    } else {
      hideBackButton();
    }
    return () => hideBackButton();
  }, [
    selectedEventId,
    activeVotingId,
    checkInModalOpen,
    costumeModalOpen,
    showBackButton,
    hideBackButton,
  ]);

  // Load profile when user is known
  useEffect(() => {
    const tgId = user?.id ? String(user.id) : undefined;
    fice
      .profile(initData, tgId)
      .then((p) => {
        if (p) {
          setProfile(p);
          setProfileName(p.fullName || '');
          setProfileGroup(p.group || '');
          setProfileBirthDate(p.birthDate ? p.birthDate.slice(0, 10) : '');
          setProfilePhone(p.phoneNumber || '');

          // Also set default registration values if not filled yet
          if (p.fullName && !regFullName) setRegFullName(p.fullName);
          if (p.group && !regGroup) setRegGroup(p.group);
          if (p.birthDate && !regBirthDate)
            setRegBirthDate(p.birthDate.slice(0, 10));
          if (p.phoneNumber && !regPhone) setRegPhone(p.phoneNumber);
        }
      })
      .catch(() => {});

    if (user?.username && !regTelegram) {
      setRegTelegram(`@${user.username}`);
    }
  }, [user, initData]);

  // Load selected event details
  useEffect(() => {
    if (!selectedEventId) {
      setSelectedEvent(null);
      setEventVotings([]);
      return;
    }
    fice
      .event(selectedEventId)
      .then((ev) => {
        setSelectedEvent(ev);
        // Pre-fill user profile info
        if (profile?.fullName) setRegFullName(profile.fullName);
        if (profile?.group) setRegGroup(profile.group);
        if (profile?.birthDate) setRegBirthDate(profile.birthDate.slice(0, 10));
        if (profile?.phoneNumber) setRegPhone(profile.phoneNumber);
        if (user?.username) setRegTelegram(`@${user.username}`);
      })
      .catch(() => {});

    fice
      .eventVotings(selectedEventId)
      .then((votings) => setEventVotings(votings))
      .catch(() => setEventVotings([]));
  }, [selectedEventId, profile, user]);

  // Verify organizer check-in access when selectedEventId changes
  useEffect(() => {
    if (!selectedEventId) {
      setCanCheckIn(false);
      setCheckInModalOpen(false);
      return;
    }
    const tgId = user?.id ? String(user.id) : undefined;
    const tgTag = user?.username ? `@${user.username}` : undefined;
    fice
      .getCheckInAccess(selectedEventId, initData, tgId, tgTag)
      .then((res) => setCanCheckIn(res.canCheckIn))
      .catch(() => setCanCheckIn(false));
  }, [selectedEventId, user, initData]);

  const loadCheckInList = useCallback(() => {
    if (!selectedEventId) return;
    setIsLoadingCheckIn(true);
    const tgId = user?.id ? String(user.id) : undefined;
    const tgTag = user?.username ? `@${user.username}` : undefined;
    fice
      .getCheckInList(selectedEventId, initData, tgId, tgTag)
      .then((res) => {
        const items = res?.items || [];
        setCheckInList(items);
        const total =
          typeof res?.total === 'number'
            ? res.total
            : (res?.stats?.total ?? items.length);
        const attendedCount =
          typeof res?.attendedCount === 'number'
            ? res.attendedCount
            : (res?.stats?.attendedCount ??
              items.filter((i: CheckInItem) => i.attended).length);
        setServerCheckInStats({ total, attendedCount });
      })
      .catch(() => {})
      .finally(() => setIsLoadingCheckIn(false));
  }, [selectedEventId, user, initData]);

  const handleToggleCheckIn = async (item: CheckInItem) => {
    if (!selectedEventId || togglingCheckInId) return;
    setTogglingCheckInId(item.id);
    haptic('medium');
    const newAttended = !item.attended;
    const tgId = user?.id ? String(user.id) : undefined;
    const tgTag = user?.username ? `@${user.username}` : undefined;
    try {
      const res = await fice.toggleCheckIn(
        selectedEventId,
        item.id,
        newAttended,
        initData,
        tgId,
        tgTag,
      );
      hapticNotify('success');
      setCheckInList((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                attended: newAttended,
                attendedAt: newAttended ? new Date().toISOString() : null,
                attendedBy: newAttended
                  ? user?.username
                    ? `@${user.username}`
                    : 'Організатор'
                  : null,
              }
            : i,
        ),
      );
      if (res?.stats?.total !== undefined || res?.total !== undefined) {
        setServerCheckInStats({
          total: res.total ?? res.stats?.total ?? checkInList.length,
          attendedCount:
            res.attendedCount ??
            res.stats?.attendedCount ??
            (newAttended ? checkInAttendedCount + 1 : Math.max(0, checkInAttendedCount - 1)),
        });
      }
    } catch {
      hapticNotify('error');
    } finally {
      setTogglingCheckInId(null);
    }
  };

  const filteredCheckInItems = useMemo(() => {
    return checkInList.filter((item) => {
      if (checkInFilter === 'UNATTENDED' && item.attended) return false;
      if (checkInFilter === 'ATTENDED' && !item.attended) return false;
      if (!checkInSearch.trim()) return true;
      const q = checkInSearch.toLowerCase().trim();
      const inName = item.fullName.toLowerCase().includes(q);
      const inGroup = item.group.toLowerCase().includes(q);
      const inTg = item.telegramTag.toLowerCase().includes(q);
      return inName || inGroup || inTg;
    });
  }, [checkInList, checkInFilter, checkInSearch]);

  // Load user registrations
  const loadMyRegistrations = useCallback(() => {
    const tgId = user?.id ? String(user.id) : undefined;
    setIsLoadingMy(true);
    fice
      .myRegistrations(initData, tgId)
      .then((res) => setMyRegistrations(res))
      .catch(() => {})
      .finally(() => setIsLoadingMy(false));
  }, [user, initData]);

  useEffect(() => {
    loadMyRegistrations();
  }, [loadMyRegistrations]);

  useEffect(() => {
    if (activeTab === 'my-events') {
      loadMyRegistrations();
    }
  }, [activeTab, loadMyRegistrations]);

  const handleCancelRegistration = async (registrationId: string) => {
    setCancellingRegId(registrationId);
    setCancelError(null);
    try {
      const tgId = user?.id ? String(user.id) : undefined;
      await fice.cancelRegistration(registrationId, initData, tgId);
      hapticNotify('success');
      setCancelSuccessMsg('Реєстрацію успішно скасовано');
      setShowCancelConfirm(false);
      setMyRegistrations((prev) => prev.filter((r) => r.id !== registrationId));
      setRegSuccess(false);
      setTimeout(() => setCancelSuccessMsg(null), 4000);
    } catch (err: unknown) {
      hapticNotify('error');
      setCancelError(
        err instanceof Error ? err.message : 'Не вдалося скасувати реєстрацію',
      );
    } finally {
      setCancellingRegId(null);
    }
  };

  // Load voting
  useEffect(() => {
    if (!activeVotingId) {
      setVotingData(null);
      return;
    }
    const tgId = user?.id ? String(user.id) : undefined;
    setIsLoadingVoting(true);
    setVotingError(null);
    fice
      .publicVoting(activeVotingId, initData, tgId)
      .then((v) => setVotingData(v))
      .catch((e) => setVotingError(e.message || 'Не вдалося завантажити голосування'))
      .finally(() => setIsLoadingVoting(false));
  }, [activeVotingId]);

  // Handle vote
  const handleVote = async (candidateId: string) => {
    if (!activeVotingId) return;
    haptic('medium');
    setIsVotingSubmitting(true);
    setVotingError(null);
    try {
      const tgId = user?.id ? String(user.id) : undefined;
      await fice.castVote(activeVotingId, candidateId, initData, tgId);
      hapticNotify('success');
      // Refresh voting data
      const v = await fice.publicVoting(activeVotingId, initData, tgId);
      setVotingData(v);
    } catch (err: unknown) {
      hapticNotify('error');
      setVotingError(
        err instanceof Error ? err.message : 'Помилка при голосуванні',
      );
    } finally {
      setIsVotingSubmitting(false);
    }
  };

  // Handle Costume Submission
  const openCostumeModal = () => {
    if (votingData?.userSubmission) {
      setCostumeName(votingData.userSubmission.name);
      setCostumeDesc(votingData.userSubmission.description || '');
      setCostumePhotoUrl(votingData.userSubmission.photoUrl);
    } else {
      setCostumeName('');
      setCostumeDesc('');
      setCostumePhotoUrl(null);
    }
    setCostumeError(null);
    setCostumeSuccessMsg(null);
    setCostumeModalOpen(true);
    haptic('light');
  };

  const handleCostumePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCostumeUploading(true);
    setCostumeError(null);
    try {
      const { url } = await fice.uploadReceipt(file);
      setCostumePhotoUrl(url);
      hapticNotify('success');
    } catch {
      setCostumeError('Не вдалося завантажити фото');
      hapticNotify('error');
    } finally {
      setCostumeUploading(false);
    }
  };

  const handleCostumeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVotingId) return;
    if (!costumeName.trim()) {
      setCostumeError('Вкажіть назву костюма або персонажа');
      return;
    }
    if (!costumePhotoUrl) {
      setCostumeError('Будь ласка, завантажте фото костюма');
      return;
    }

    setCostumeSubmitting(true);
    setCostumeError(null);
    haptic('medium');

    try {
      const tgId = user?.id ? String(user.id) : undefined;
      await fice.submitCostumeCandidate(
        activeVotingId,
        {
          name: costumeName.trim(),
          description: costumeDesc.trim() || undefined,
          photoUrl: costumePhotoUrl,
        },
        initData,
        tgId,
      );

      // Refresh voting data
      const v = await fice.publicVoting(activeVotingId, initData, tgId);
      setVotingData(v);
      hapticNotify('success');
      setCostumeSuccessMsg('Заявку успішно надіслано на модерацію!');
      setTimeout(() => {
        setCostumeModalOpen(false);
        setCostumeSuccessMsg(null);
      }, 1500);
    } catch (err: unknown) {
      hapticNotify('error');
      setCostumeError(
        err instanceof Error ? err.message : 'Помилка при поданні заявки',
      );
    } finally {
      setCostumeSubmitting(false);
    }
  };

  // Handle Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    haptic('light');
    setIsProfileSaving(true);
    try {
      const tgId = user?.id ? String(user.id) : undefined;
      const updated = await fice.updateProfile(
        {
          fullName: profileName.trim(),
          group: profileGroup.trim(),
          birthDate: profileBirthDate || null,
          phoneNumber: profilePhone.trim() || null,
        },
        initData,
        tgId,
      );
      setProfile(updated);
      hapticNotify('success');
      setProfileSavedMsg(true);
      setTimeout(() => setProfileSavedMsg(false), 3000);
    } catch {
      hapticNotify('error');
    } finally {
      setIsProfileSaving(false);
    }
  };

  // Handle Registration Receipt Upload
  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRegUploading(true);
    try {
      const { url } = await fice.uploadReceipt(file);
      setRegReceiptUrl(url);
      hapticNotify('success');
    } catch {
      hapticNotify('error');
    } finally {
      setRegUploading(false);
    }
  };

  // Handle Registration Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    setRegSubmitError(null);

    const errs: Record<string, string> = {};
    if (!regFullName.trim()) errs.fullName = 'Вкажи ПІБ';
    if (!regTelegram.trim()) errs.telegram = 'Вкажи Telegram';
    if (!regGroup.trim()) errs.group = 'Вкажи академічну групу';

    const fee = selectedEvent.feeAmount ? Number(selectedEvent.feeAmount) : 0;
    const hasFee = fee > 0;
    if (hasFee && !regPayment) errs.payment = 'Обери спосіб оплати';
    if (regPayment === 'DONATED' && !regReceiptUrl) {
      errs.receipt = 'Додай скриншот оплати';
    }

    const questions = selectedEvent.questions ?? [];
    for (const q of questions) {
      if (q.required && !(regAnswers[q.id] ?? '').trim()) {
        errs[`q_${q.id}`] = 'Обовʼязкове поле';
      }
    }

    if (!regConsent) {
      errs.consent = 'Потрібна згода на обробку персональних даних';
    }

    setRegErrors(errs);
    if (Object.keys(errs).length > 0) {
      setRegSubmitError('Будь ласка, заповніть усі обовʼязкові поля');
      hapticNotify('warning');
      return;
    }

    setRegSubmitting(true);
    try {
      const tgId = user?.id ? String(user.id) : undefined;
      await fice.registerEvent(selectedEvent.id, {
        fullName: regFullName.trim(),
        telegramTag: `@${regTelegram.trim().replace(/^@+/, '')}`,
        group: regGroup.trim(),
        birthDate: regBirthDate || undefined,
        payment: hasFee ? (regPayment as RegistrationPayment) : 'NONE',
        receiptUrl: regReceiptUrl ?? undefined,
        telegramUserId: tgId,
        phoneNumber: regPhone.trim() || undefined,
        saveProfile: regSaveProfile,
        answers: questions
          .map((q) => ({
            questionId: q.id,
            value: (regAnswers[q.id] ?? '').trim(),
          }))
          .filter((a) => a.value.length > 0),
      });

      hapticNotify('success');
      setRegSuccess(true);
      loadMyRegistrations();
      setRegSubmitError(null);

      // Trigger Confetti
      const canvas = confettiCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const W = (canvas.width = canvas.offsetWidth);
        const H = (canvas.height = canvas.offsetHeight);
        const colors = ['#2eff97', '#36dfff', '#ad46ff', '#ff8904'];
        const particles = Array.from({ length: 65 }, () => ({
          x: W / 2 + (Math.random() - 0.5) * 50,
          y: H / 2,
          vx: (Math.random() - 0.5) * 6,
          vy: -Math.random() * 5 - 2,
          w: Math.random() * 6 + 4,
          h: Math.random() * 4 + 3,
          color: colors[(Math.random() * colors.length) | 0],
          life: 1,
          decay: 0.007 + Math.random() * 0.005,
          flutter: Math.random() * Math.PI * 2,
        }));
        let animId: number;
        const render = () => {
          ctx.clearRect(0, 0, W, H);
          let alive = false;
          for (const p of particles) {
            p.flutter += 0.07;
            p.x += p.vx + Math.sin(p.flutter) * 0.6;
            p.y += p.vy;
            p.vx *= 0.96;
            p.vy = Math.min(2.4, p.vy * 0.98 + 0.1);
            p.life -= p.decay;
            if (p.life > 0) alive = true;
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillRect(p.x, p.y, p.w, p.h);
          }
          if (alive) animId = requestAnimationFrame(render);
        };
        render();
      }
    } catch (err: unknown) {
      hapticNotify('error');
      const msg =
        err instanceof Error
          ? err.message
          : 'Не вдалося зареєструватися. Спробуйте ще раз.';
      setRegSubmitError(msg);
    } finally {
      setRegSubmitting(false);
    }
  };

  const fmtDate = (
    iso: string,
    hasTimeFlag?: boolean,
    timeStr?: string | null,
  ) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;

      const datePart = new Intl.DateTimeFormat('uk-UA', {
        day: 'numeric',
        month: 'long',
        timeZone: 'Europe/Kyiv',
      }).format(d);

      if (hasTimeFlag === false) {
        return `${datePart} (час буде повідомлено згодом)`;
      }

      if (timeStr && timeStr.trim()) {
        return `${datePart} о ${timeStr.trim()}`;
      }

      const timePart = new Intl.DateTimeFormat('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Kyiv',
      }).format(d);

      if (timePart === '00:00' && hasTimeFlag !== true) {
        return `${datePart} (час буде повідомлено згодом)`;
      }

      return `${datePart} о ${timePart}`;
    } catch {
      return iso;
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
      </div>
    );
  }

  if (!isTelegram) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-bg text-fg">
        <div className="mb-6">
          <Image
            src="/logo_white.png"
            alt="Студрада ФІОТ"
            width={160}
            height={55}
            priority
            className="h-12 w-auto object-contain mx-auto"
          />
        </div>
        <div className="max-w-xs space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan">
            <svg
              className="h-7 w-7"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
            </svg>
          </div>
          <h1 className="text-lg font-black text-fg">
            Доступ лише через Telegram
          </h1>
          <p className="text-xs text-muted leading-relaxed">
            Цей додаток працює виключно всередині месенджера Telegram. Відкрийте наш бот для перегляду заходів, реєстрацій та голосувань.
          </p>
          <a
            href="https://t.me/fice_events_bot/app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-main py-3 text-xs font-bold text-black shadow-glow-cyan transition-opacity hover:opacity-95"
          >
            Відкрити бота @fice_events_bot →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      {/* Header Banner */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-bg/95 px-4 py-3 backdrop-blur-xl">
        <Image
          src="/logo_white.png"
          alt="Студрада ФІОТ"
          width={130}
          height={40}
          priority
          className="h-8 sm:h-9 w-auto object-contain"
        />
      </header>

      {/* Main Views */}
      <main className="p-4 space-y-4">
        {/* ================= MODAL: VOTING SCREEN ================= */}
        {activeVotingId && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center p-2"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                haptic('light');
                setActiveVotingId(null);
              }
            }}
          >
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-surface p-5 space-y-4 shadow-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-purple">
                    {votingData?.eventName || 'Голосування'}
                  </span>
                  <h2 className="text-xl font-black text-fg mt-0.5">
                    {votingData?.title || 'Завантаження…'}
                  </h2>
                </div>
                <button
                  onClick={() => setActiveVotingId(null)}
                  className="rounded-full bg-bg p-1.5 text-muted hover:text-fg text-sm"
                >
                  ✕
                </button>
              </div>

              {isLoadingVoting ? (
                <div className="py-12 text-center text-muted text-sm">
                  Завантаження голосування…
                </div>
              ) : votingError ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-400">
                  {votingError}
                </div>
              ) : votingData ? (
                <div className="space-y-4">
                  {votingData.description && (
                    <p className="text-sm text-muted whitespace-pre-line">
                      {votingData.description}
                    </p>
                  )}

                  {votingData.hasVoted && (
                    <div className="rounded-2xl border border-brand-green/40 bg-brand-green/10 p-3.5 text-sm text-brand-green flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4 shrink-0 text-brand-green"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="font-semibold">
                          Ваш голос зараховано! Дякуємо за участь.
                        </span>
                      </div>
                      {votingData.allowChangeVote && votingData.status === 'ACTIVE' && (
                        <span className="text-xs text-muted shrink-0 font-medium">
                          Можна змінити
                        </span>
                      )}
                    </div>
                  )}

                  {votingData.onlyRegistered && !votingData.isRegistered && !votingData.hasVoted && (
                    <div className="rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-3.5 space-y-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-yellow-300">
                        <svg
                          className="h-4 w-4 shrink-0 text-yellow-300"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                        <span>Потрібна реєстрація на захід</span>
                      </div>
                      <p className="text-xs text-muted leading-relaxed">
                        Голосування та участь доступні для зареєстрованих учасників заходу «{votingData.eventName}».
                      </p>
                      <Button
                        type="button"
                        onClick={() => {
                          setSelectedEventId(votingData.eventId);
                          setActiveVotingId(null);
                          setActiveTab('events');
                        }}
                        className="w-full text-xs py-2 font-bold bg-brand-cyan text-black hover:bg-brand-cyan/90 shadow-md"
                      >
                        📝 Зареєструватися зараз
                      </Button>
                    </div>
                  )}

                  {/* Costume Contest Submission Section */}
                  {votingData.allowSubmissions &&
                    (votingData.submissionsOpen || !!votingData.userSubmission) && (
                      <div className="rounded-2xl border border-purple-500/40 bg-purple-950/20 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🎭</span>
                          <span className="text-xs font-black uppercase tracking-wider text-purple-300">
                            Конкурс костюмів
                          </span>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            votingData.submissionsOpen
                              ? 'bg-brand-green/20 text-brand-green border border-brand-green/30'
                              : 'bg-white/10 text-muted border border-white/10'
                          }`}
                        >
                          {votingData.submissionsOpen ? 'Прийом відкрито' : 'Прийом закрито'}
                        </span>
                      </div>

                      {votingData.userSubmission ? (
                        <div className="space-y-3">
                          <div className="flex gap-3 items-center rounded-xl bg-bg/60 p-3 border border-border">
                            {votingData.userSubmission.photoUrl && (
                              <img
                                src={
                                  mediaUrl(votingData.userSubmission.photoUrl) ||
                                  votingData.userSubmission.photoUrl
                                }
                                alt={votingData.userSubmission.name}
                                className="h-16 w-16 rounded-xl object-cover border border-white/10 shrink-0"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-black text-sm text-fg truncate">
                                  {votingData.userSubmission.name}
                                </span>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                    votingData.userSubmission.status === 'PENDING'
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : votingData.userSubmission.status === 'APPROVED'
                                      ? 'bg-brand-green/20 text-brand-green border border-brand-green/30'
                                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  }`}
                                >
                                  {votingData.userSubmission.status === 'PENDING'
                                    ? '🟡 На модерації'
                                    : votingData.userSubmission.status === 'APPROVED'
                                    ? '🟢 Схвалено'
                                    : '🔴 Відхилено'}
                                </span>
                              </div>
                              {votingData.userSubmission.description && (
                                <p className="text-xs text-muted line-clamp-1 mt-0.5">
                                  {votingData.userSubmission.description}
                                </p>
                              )}
                              <p className="text-[11px] text-muted mt-1">
                                {votingData.userSubmission.status === 'PENDING' &&
                                  'Ваш костюм на перевірці у адміністратора. Після схвалення він зʼявиться у списку для голосування.'}
                                {votingData.userSubmission.status === 'APPROVED' &&
                                  'Ваш костюм бере участь у голосуванні!'}
                                {votingData.userSubmission.status === 'REJECTED' &&
                                  (votingData.userSubmission.rejectionReason
                                    ? `Причина: ${votingData.userSubmission.rejectionReason}`
                                    : 'Заявку відхилено адміністратором.')}
                              </p>
                            </div>
                          </div>

                          {votingData.submissionsOpen && (
                            <Button
                              variant="outline"
                              onClick={openCostumeModal}
                              className="w-full text-xs py-2 border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                            >
                              ✏️ Змінити заявку / перезавантажити фото
                            </Button>
                          )}
                        </div>
                      ) : votingData.submissionsOpen ? (
                        votingData.onlyRegistered && !votingData.isRegistered ? (
                          <div className="space-y-2.5">
                            <p className="text-xs text-yellow-300/90 leading-relaxed">
                              ⚠️ Тільки зареєстровані учасники заходу можуть подати фото образу. Спочатку зареєструйтесь на захід.
                            </p>
                            <Button
                              type="button"
                              onClick={() => {
                                setSelectedEventId(votingData.eventId);
                                setActiveVotingId(null);
                                setActiveTab('events');
                              }}
                              className="w-full text-xs py-2.5 font-bold bg-brand-cyan text-black hover:bg-brand-cyan/90 shadow-md"
                            >
                              📝 Зареєструватися на захід
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            <p className="text-xs text-muted">
                              Берете участь у костюмі? Завантажте фото образу та змагайтеся за звання найкращого образу заходу!
                            </p>
                            <Button
                              onClick={openCostumeModal}
                              className="w-full text-xs py-2.5 font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/20"
                            >
                              📸 Подати заявку на конкурс костюмів
                            </Button>
                          </div>
                        )
                      ) : (
                        <p className="text-xs text-muted">
                          Прийом заявок на конкурс костюмів наразі закрито.
                        </p>
                      )}
                    </div>
                  )}

                  {votingData.candidates.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted">
                      {votingData.allowSubmissions && votingData.submissionsOpen
                        ? 'Учасники ще подають заявки. Станьте першим, завантаживши фото вище!'
                        : 'Список кандидатів наразі порожній.'}
                    </div>
                  ) : null}

                  <div className="space-y-2.5">
                    {votingData.candidates.map((cand) => {
                      const isChosen = votingData.votedCandidateId === cand.id;
                      return (
                        <div
                          key={cand.id}
                          className={`relative overflow-hidden rounded-2xl border p-3.5 transition-all ${
                            isChosen
                              ? 'border-brand-cyan bg-brand-cyan/10'
                              : 'border-border bg-bg/60 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {cand.photoUrl ? (
                              <img
                                src={mediaUrl(cand.photoUrl) || cand.photoUrl}
                                alt={cand.name}
                                className="h-16 w-16 rounded-xl object-cover border border-white/10"
                              />
                            ) : (
                              <div className="h-16 w-16 rounded-xl bg-surface flex items-center justify-center border border-border text-muted">
                                <svg
                                  className="h-7 w-7"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                  />
                                </svg>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-black text-base text-fg truncate">
                                {cand.name}
                              </div>
                              {cand.description && (
                                <div className="text-xs text-muted line-clamp-2 mt-0.5">
                                  {cand.description}
                                </div>
                              )}
                              {cand.percent !== undefined && (
                                <div className="text-xs font-bold text-brand-cyan mt-1">
                                  {cand.votesCount} голосів ({cand.percent}%)
                                </div>
                              )}
                            </div>

                            {!votingData.hasVoted &&
                              votingData.status === 'ACTIVE' &&
                              (!votingData.onlyRegistered || votingData.isRegistered) && (
                                <Button
                                  className="px-4 py-2 text-xs font-bold"
                                  disabled={isVotingSubmitting}
                                  onClick={() => handleVote(cand.id)}
                                >
                                  Голос
                                </Button>
                              )}

                            {!votingData.hasVoted &&
                              votingData.status === 'ACTIVE' &&
                              votingData.onlyRegistered &&
                              !votingData.isRegistered && (
                                <Button
                                  variant="outline"
                                  className="px-3 py-2 text-xs font-semibold border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10 shrink-0"
                                  onClick={() => {
                                    setSelectedEventId(votingData.eventId);
                                    setActiveVotingId(null);
                                    setActiveTab('events');
                                  }}
                                >
                                  Зареєструватись
                                </Button>
                              )}

                            {isChosen && (
                              <span className="text-xs font-extrabold text-brand-cyan px-2">
                                Твій вибір
                              </span>
                            )}

                            {votingData.hasVoted &&
                              !isChosen &&
                              votingData.allowChangeVote &&
                              votingData.status === 'ACTIVE' &&
                              (!votingData.onlyRegistered || votingData.isRegistered) && (
                                <Button
                                  variant="outline"
                                  className="px-3.5 py-2 text-xs font-bold border-brand-cyan/40 text-brand-cyan hover:bg-brand-cyan/10"
                                  disabled={isVotingSubmitting}
                                  onClick={() => handleVote(cand.id)}
                                >
                                  Змінити
                                </Button>
                              )}
                          </div>

                          {cand.percent !== undefined && (
                            <div className="mt-2 h-1.5 w-full rounded-full bg-surface overflow-hidden">
                              <div
                                className="h-full bg-brand-cyan rounded-full"
                                style={{ width: `${cand.percent}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* ================= MODAL: ORGANIZER CHECK-IN ================= */}
        {checkInModalOpen && selectedEvent && (
          <div className="fixed inset-0 z-50 flex flex-col bg-bg text-fg">
            {/* Header */}
            <div className="border-b border-border bg-surface/95 backdrop-blur px-4 pb-3.5 flex items-center justify-between shrink-0">
              <div className="min-w-0 flex-1 pr-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-brand-cyan animate-pulse" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-brand-cyan">
                    Організатор · Відмітка
                  </span>
                </div>
                <h2 className="text-base font-black truncate text-fg mt-0.5">
                  {selectedEvent.name}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadCheckInList}
                  disabled={isLoadingCheckIn}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-white/5 px-2.5 py-1.5 text-muted hover:text-fg hover:bg-white/10 text-xs font-semibold transition-colors active:scale-95"
                  title="Оновити список"
                >
                  <svg
                    className={cn('w-3.5 h-3.5', isLoadingCheckIn && 'animate-spin')}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span>Оновити</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCheckInModalOpen(false)}
                  className="rounded-xl border border-border bg-white/5 p-2 text-muted hover:text-fg hover:bg-white/10 text-xs transition-colors active:scale-95"
                  title="Закрити"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* KPI Stats & Progress Bar */}
            <div className="border-b border-border bg-surface/50 px-4 py-3 shrink-0 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-muted">Прогрес чек-іну:</span>
                <span className="font-black text-brand-cyan">
                  {checkInAttendedCount} / {checkInTotal} відмічено ({checkInPercentage}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-brand-cyan to-brand-green transition-all duration-300"
                  style={{
                    width: `${checkInPercentage}%`,
                  }}
                />
              </div>

              {/* Search input */}
              <div className="relative pt-1">
                <input
                  type="text"
                  value={checkInSearch}
                  onChange={(e) => setCheckInSearch(e.target.value)}
                  placeholder="Швидкий пошук: ПІБ, група, @тег..."
                  className="w-full rounded-xl border border-border bg-bg px-3.5 py-2 text-xs text-fg placeholder:text-subtle outline-none transition-colors focus:border-brand-cyan"
                />
                {checkInSearch && (
                  <button
                    onClick={() => setCheckInSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-fg pt-1"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter pills */}
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setCheckInFilter('ALL')}
                  className={cn(
                    'flex-1 text-center py-1.5 rounded-lg text-xs font-bold transition-colors',
                    checkInFilter === 'ALL'
                      ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40'
                      : 'bg-white/5 text-muted hover:text-fg border border-border',
                  )}
                >
                  Всі ({checkInTotal})
                </button>
                <button
                  type="button"
                  onClick={() => setCheckInFilter('UNATTENDED')}
                  className={cn(
                    'flex-1 text-center py-1.5 rounded-lg text-xs font-bold transition-colors',
                    checkInFilter === 'UNATTENDED'
                      ? 'bg-brand-orange/20 text-brand-orange border border-brand-orange/40'
                      : 'bg-white/5 text-muted hover:text-fg border border-border',
                  )}
                >
                  Очікуються ({checkInUnattendedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setCheckInFilter('ATTENDED')}
                  className={cn(
                    'flex-1 text-center py-1.5 rounded-lg text-xs font-bold transition-colors',
                    checkInFilter === 'ATTENDED'
                      ? 'bg-brand-green/20 text-brand-green border border-brand-green/40'
                      : 'bg-white/5 text-muted hover:text-fg border border-border',
                  )}
                >
                  Відмічені ({checkInAttendedCount})
                </button>
              </div>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {isLoadingCheckIn ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted text-xs">
                  <span className="animate-spin text-2xl">⏳</span>
                  <span>Завантаження списку реєстрацій…</span>
                </div>
              ) : filteredCheckInItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-1 text-xs text-muted">
                  <div className="text-2xl mb-1">
                    {checkInFilter === 'UNATTENDED' && checkInTotal > 0 ? '🎉' : '🔍'}
                  </div>
                  <div className="font-bold text-fg">
                    {checkInFilter === 'UNATTENDED' && checkInTotal > 0
                      ? 'Всі учасники вже відмічені!'
                      : 'Нікого не знайдено'}
                  </div>
                  <div>Спробуйте змінити фільтр або пошуковий запит.</div>
                </div>
              ) : (
                filteredCheckInItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className={cn(
                      'rounded-2xl border p-3.5 transition-all flex items-center justify-between gap-3',
                      item.attended
                        ? 'border-brand-green/30 bg-brand-green/5'
                        : 'border-border bg-surface hover:border-white/20',
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-muted">
                          #{idx + 1}
                        </span>
                        <div className="font-bold text-sm text-fg truncate">
                          {item.fullName}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap text-xs">
                        <span className="rounded-md border border-brand-cyan/30 bg-brand-cyan/10 px-1.5 py-0.5 font-mono font-bold text-brand-cyan text-[11px]">
                          {item.group}
                        </span>
                        {item.telegramTag && (
                          <a
                            href={`https://t.me/${item.telegramTag.replace(/^@/, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted hover:text-brand-cyan text-[11px]"
                          >
                            {item.telegramTag}
                          </a>
                        )}
                        {item.payment && item.payment !== 'NONE' && (
                          <span className="rounded-md border border-brand-orange/30 bg-brand-orange/10 px-1.5 py-0.5 text-brand-orange text-[10px] font-bold">
                            {item.payment === 'DONATED' ? 'Задонатив' : 'На вході'}
                          </span>
                        )}
                      </div>
                      {item.attended && item.attendedAt && (
                        <div className="text-[10px] text-brand-green font-medium">
                          ✓ Відмічено о {new Date(item.attendedAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                          {item.attendedBy ? ` (${item.attendedBy})` : ''}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={togglingCheckInId === item.id}
                      onClick={() => handleToggleCheckIn(item)}
                      className={cn(
                        'shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95',
                        item.attended
                          ? 'bg-brand-green/20 text-brand-green border border-brand-green/40 hover:bg-brand-green/30'
                          : 'bg-brand-cyan text-black hover:bg-brand-cyan/90',
                      )}
                    >
                      {togglingCheckInId === item.id ? (
                        <span className="animate-spin">⏳</span>
                      ) : item.attended ? (
                        <>
                          <span>✓</span>
                          <span>Присутній</span>
                        </>
                      ) : (
                        <>
                          <span>Відмітити</span>
                          <span>→</span>
                        </>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ================= MODAL: COSTUME SUBMISSION ================= */}
        {costumeModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center p-2"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                haptic('light');
                setCostumeModalOpen(false);
              }
            }}
          >
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-surface p-5 space-y-4 shadow-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                    Конкурс костюмів
                  </span>
                  <h3 className="text-lg font-black text-fg mt-0.5">
                    {votingData?.userSubmission ? 'Редагувати заявку' : 'Подати фото образу'}
                  </h3>
                </div>
                <button
                  onClick={() => setCostumeModalOpen(false)}
                  className="rounded-full bg-bg p-1.5 text-muted hover:text-fg text-sm"
                >
                  ✕
                </button>
              </div>

              {costumeSuccessMsg ? (
                <div className="rounded-2xl border border-brand-green/30 bg-brand-green/10 p-4 text-center text-sm font-bold text-brand-green">
                  {costumeSuccessMsg}
                </div>
              ) : (
                <form onSubmit={handleCostumeSubmit} className="space-y-4">
                  {votingData?.userSubmission && (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 leading-relaxed">
                      ⚠️ <b>Зверніть увагу:</b> після збереження змін ваша заявка буде надіслана на повторну модерацію адміністратором.
                    </div>
                  )}
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                      Фото вашого образу *
                    </label>
                    {costumePhotoUrl ? (
                      <div className="relative rounded-2xl overflow-hidden border border-border group">
                        <img
                          src={mediaUrl(costumePhotoUrl) || costumePhotoUrl}
                          alt="Образ"
                          className="w-full h-52 object-cover"
                        />
                        <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-white text-xs font-bold">
                          <span>Змінити фото</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleCostumePhotoUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-36 rounded-2xl border-2 border-dashed border-border hover:border-purple-500/50 bg-bg/50 cursor-pointer p-4 text-center transition-colors">
                        {costumeUploading ? (
                          <div className="text-xs text-muted flex flex-col items-center gap-2">
                            <span className="animate-spin text-lg">⏳</span>
                            <span>Завантаження фото…</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-muted">
                            <span className="text-2xl">📸</span>
                            <span className="text-xs font-bold text-fg">
                              Натисніть для вибору фото
                            </span>
                            <span className="text-[10px]">
                              Бажано у повний зріст або чітке фото костюма
                            </span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCostumePhotoUpload}
                          disabled={costumeUploading}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-fg">
                      Назва образу / Персонаж *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Наприклад: Нео з Матриці або Відьмак"
                      value={costumeName}
                      onChange={(e) => setCostumeName(e.target.value)}
                      className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-fg placeholder:text-muted/60 focus:border-brand-cyan focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-fg">
                      Опис образу (опціонально)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Розкажіть трохи про деталі, як створювався костюм..."
                      value={costumeDesc}
                      onChange={(e) => setCostumeDesc(e.target.value)}
                      className="w-full rounded-xl border border-border bg-bg px-3.5 py-2 text-sm text-fg placeholder:text-muted/60 focus:border-brand-cyan focus:outline-none resize-none"
                    />
                  </div>

                  {costumeError && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                      {costumeError}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 text-xs py-2.5"
                      onClick={() => setCostumeModalOpen(false)}
                    >
                      Скасувати
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        !costumeName.trim() ||
                        !costumePhotoUrl ||
                        costumeUploading ||
                        costumeSubmitting
                      }
                      className="flex-1 text-xs py-2.5 font-bold bg-purple-600 hover:bg-purple-500 text-white"
                    >
                      {costumeSubmitting ? 'Надсилання…' : 'Надіслати на розгляд'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ================= VIEW: EVENT DETAILS & REGISTRATION ================= */}
        {selectedEventId && selectedEvent ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between pt-1 pb-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedEventId(null);
                  setRegSuccess(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-surface px-3.5 py-1.5 text-xs font-bold text-muted hover:text-fg hover:border-white/20 transition-all shadow-sm"
              >
                ← Назад до афіші
              </button>
            </div>

            {/* Organizer Check-In Banner */}
            {canCheckIn && (
              <div className="relative overflow-hidden rounded-2xl border border-brand-cyan/40 bg-gradient-to-r from-brand-cyan/20 via-brand-purple/15 to-brand-cyan/10 p-4 shadow-lg">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 rounded-full bg-brand-cyan animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-wider text-brand-cyan">
                        Режим організатора
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-fg">
                      Відмітка учасників на вході
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      haptic('light');
                      loadCheckInList();
                      setCheckInModalOpen(true);
                    }}
                    className="shrink-0 text-xs font-black px-4 py-2.5 bg-brand-cyan text-black hover:bg-brand-cyan/90 shadow-md"
                  >
                    Чек-ін
                  </Button>
                </div>
              </div>
            )}

            <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-4 sm:p-5 space-y-3.5">
              {selectedEvent.photoUrl && (
                <div className="h-48 sm:h-64 w-full overflow-hidden rounded-2xl border border-white/10 bg-surface">
                  <img
                    src={mediaUrl(selectedEvent.photoUrl) || selectedEvent.photoUrl}
                    alt={selectedEvent.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              <div>
                <h1 className="text-xl sm:text-2xl font-black text-fg leading-snug">
                  {selectedEvent.name}
                </h1>
                <div className="mt-1.5 flex items-center gap-1.5 text-sm text-brand-cyan font-semibold">
                  <svg
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span>{fmtDate(selectedEvent.date, selectedEvent.hasTime, selectedEvent.time)}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                  <svg
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span>
                    {selectedEvent.location?.trim()
                      ? selectedEvent.location.trim()
                      : 'Локація: буде повідомлено згодом'}
                  </span>
                </div>
              </div>

              {selectedEvent.description && (
                <div
                  className="text-sm sm:text-base text-gray-300 leading-relaxed whitespace-pre-wrap pt-1"
                  dangerouslySetInnerHTML={{
                    __html: renderRichInline(selectedEvent.description),
                  }}
                />
              )}

              {/* Fee info */}
              {selectedEvent.feeAmount && Number(selectedEvent.feeAmount) > 0 && (
                <div className="rounded-2xl border border-brand-purple/30 bg-brand-purple/10 p-3.5 text-sm flex justify-between items-center">
                  <span className="text-muted">Благодійний внесок:</span>
                  <span className="font-black text-brand-purple text-base">
                    {Number(selectedEvent.feeAmount)} грн
                  </span>
                </div>
              )}

              {/* Event Votings / Contests */}
              {eventVotings.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                      <span>🎭</span>
                      <span>Конкурси та голосування заходу</span>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {eventVotings.map((vt) => (
                      <div
                        key={vt.id}
                        onClick={() => {
                          haptic('light');
                          setActiveVotingId(vt.id);
                        }}
                        className="group flex items-center justify-between rounded-2xl border border-purple-500/40 bg-gradient-to-r from-purple-500/15 via-purple-500/5 to-surface p-4 transition-all hover:border-purple-500/70 cursor-pointer shadow-md"
                      >
                        <div className="min-w-0 pr-3 space-y-1 flex-1">
                          <div className="text-sm font-black text-fg group-hover:text-purple-300 transition-colors flex items-center gap-2">
                            <span>🗳️</span>
                            <span className="truncate">{vt.title}</span>
                          </div>
                          <div className="text-xs text-muted flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                            <span className="inline-flex items-center gap-1 text-purple-300 font-semibold shrink-0">
                              <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                              {vt.status === 'ACTIVE' ? 'Голосування триває' : 'Завершено'}
                            </span>
                            <span className="shrink-0">•</span>
                            <span className="shrink-0">{vt.totalVotes} голосів</span>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-xl border border-purple-500/50 bg-purple-500/20 px-3.5 py-2 text-xs font-black text-purple-200 group-hover:bg-purple-500/30 transition-colors shadow-sm">
                          {vt.status === 'ACTIVE' ? 'Взяти участь →' : 'Результати →'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Registration Form */}
            {regSuccess ? (
              <div className="relative overflow-hidden rounded-3xl border border-brand-green/40 bg-brand-green/10 p-6 text-center space-y-3">
                <canvas
                  ref={confettiCanvasRef}
                  className="pointer-events-none absolute inset-0 h-full w-full"
                />
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-green/20 text-brand-green border border-brand-green/30">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-black text-fg">
                  Реєстрацію успішно підтверджено!
                </h3>
                <p className="text-xs text-gray-300">
                  Чекаємо на тебе на заході! Ти можеш переглянути деталі цієї реєстрації у вкладці «Мої заходи».
                </p>
                <Button
                  onClick={() => {
                    setSelectedEventId(null);
                    setRegSuccess(false);
                    setActiveTab('my-events');
                  }}
                  className="w-full text-xs font-bold"
                >
                  Перейти до моїх заходів →
                </Button>
              </div>
            ) : myRegistrations.some((r) => r.eventId === selectedEvent.id) ? (
              (() => {
                const existingReg = myRegistrations.find(
                  (r) => r.eventId === selectedEvent.id,
                )!;
                return (
                  <div className="rounded-3xl border border-brand-green/40 bg-gradient-to-b from-brand-green/10 via-surface/80 to-surface p-5 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-green" />
                          </span>
                          <span className="text-xs font-black uppercase tracking-wider text-brand-green">
                            Ви зареєстровані
                          </span>
                        </div>
                        <p className="text-xs text-muted">
                          Ваша реєстрація дійсна для входу
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/80 bg-surface/80 p-3.5 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-muted">Учасник:</span>
                        <span className="font-bold text-fg">
                          {existingReg.fullName}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted">Група:</span>
                        <span className="font-bold text-fg">
                          {existingReg.group}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted">Telegram:</span>
                        <span className="font-bold text-brand-cyan">
                          {existingReg.telegramTag}
                        </span>
                      </div>
                      {existingReg.payment && existingReg.payment !== 'NONE' && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted">Оплата:</span>
                          <span className="font-bold text-brand-green">
                            {existingReg.payment === 'DONATED'
                              ? 'Донат надіслано'
                              : 'Оплата на вході'}
                          </span>
                        </div>
                      )}
                      {existingReg.answers && existingReg.answers.length > 0 && (
                        <div className="pt-2 border-t border-border/60 space-y-1">
                          <span className="text-muted font-bold block text-[11px] uppercase tracking-wider">
                            Відповіді:
                          </span>
                          {existingReg.answers.map((a) => (
                            <div
                              key={a.id}
                              className="bg-bg/60 rounded-xl p-2 text-[11px]"
                            >
                              <span className="text-muted block">
                                {a.question?.label || 'Питання'}:
                              </span>
                              <span className="text-fg font-medium">
                                {a.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {cancelError && (
                      <div className="rounded-xl border border-brand-red/40 bg-brand-red/10 p-3 text-xs text-brand-red text-center">
                        {cancelError}
                      </div>
                    )}

                    {showCancelConfirm ? (
                      <div className="rounded-2xl border border-brand-red/40 bg-brand-red/10 p-4 space-y-3 text-center animate-in fade-in">
                        <p className="text-xs font-bold text-fg">
                          Справді скасувати реєстрацію?
                        </p>
                        <p className="text-[11px] text-muted leading-relaxed">
                          Твоє місце буде скасовано. Ти зможеш зареєструватися
                          знову, якщо реєстрація відкрита.
                        </p>
                        <div className="flex gap-2 justify-center pt-1">
                          <button
                            type="button"
                            onClick={() => setShowCancelConfirm(false)}
                            disabled={cancellingRegId === existingReg.id}
                            className="rounded-xl border border-border bg-surface px-4 py-2 text-xs font-bold text-muted hover:text-fg disabled:opacity-50 transition-colors"
                          >
                            Ні, залишити
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleCancelRegistration(existingReg.id)
                            }
                            disabled={cancellingRegId === existingReg.id}
                            className="rounded-xl border border-brand-red/40 bg-brand-red px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-brand-red/90 disabled:opacity-50 transition-colors"
                          >
                            {cancellingRegId === existingReg.id
                              ? 'Скасування…'
                              : 'Так, скасувати'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          haptic('light');
                          setShowCancelConfirm(true);
                        }}
                        className="w-full flex items-center justify-center gap-2 rounded-2xl border border-brand-red/30 bg-brand-red/5 py-3 text-xs font-bold text-brand-red transition-all hover:bg-brand-red/15 active:scale-[0.98]"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        <span>Скасувати реєстрацію</span>
                      </button>
                    )}
                  </div>
                );
              })()
            ) : selectedEvent.noRegistration ? (
              <div className="rounded-2xl border border-border bg-surface p-4 text-center text-xs text-muted">
                Вхід вільний, попередня реєстрація не потрібна.
              </div>
            ) : (
              <form
                onSubmit={handleRegisterSubmit}
                className="rounded-3xl border border-border bg-surface p-5 space-y-3.5 shadow-xl"
              >
                {cancelSuccessMsg && (
                  <div className="rounded-2xl border border-brand-green/40 bg-brand-green/10 p-3 text-xs text-brand-green text-center font-bold">
                    {cancelSuccessMsg}
                  </div>
                )}
                <div className="border-b border-border pb-2.5">
                  <h3 className="font-black text-base text-fg">
                    Форма реєстрації
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Заповни дані для участі у заході
                  </p>
                </div>

                <Input
                  label="ПІБ"
                  placeholder="Шевченко Тарас Григорович"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  error={regErrors.fullName}
                  required
                />

                <div className="grid grid-cols-2 gap-2.5">
                  <Input
                    label="Група"
                    placeholder="ІП-31"
                    value={regGroup}
                    onChange={(e) => setRegGroup(e.target.value)}
                    error={regErrors.group}
                    required
                  />
                  <Input
                    label="Telegram"
                    placeholder="@username"
                    value={regTelegram}
                    onChange={(e) => setRegTelegram(e.target.value)}
                    error={regErrors.telegram}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <Input
                    label="Дата народження"
                    type="date"
                    value={regBirthDate}
                    onChange={(e) => setRegBirthDate(e.target.value)}
                  />
                  <Input
                    label="Номер телефону"
                    type="tel"
                    placeholder="+380..."
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                  />
                </div>

                {/* Custom event questions */}
                {(selectedEvent.questions ?? []).map((q) => (
                  <div key={q.id}>
                    {q.type === 'LONG_TEXT' ? (
                      <Textarea
                        label={q.label}
                        value={regAnswers[q.id] || ''}
                        onChange={(e) =>
                          setRegAnswers((prev) => ({
                            ...prev,
                            [q.id]: e.target.value,
                          }))
                        }
                        error={regErrors[`q_${q.id}`]}
                        required={q.required}
                      />
                    ) : (
                      <Input
                        label={q.label}
                        value={regAnswers[q.id] || ''}
                        onChange={(e) =>
                          setRegAnswers((prev) => ({
                            ...prev,
                            [q.id]: e.target.value,
                          }))
                        }
                        error={regErrors[`q_${q.id}`]}
                        required={q.required}
                      />
                    )}
                  </div>
                ))}

                {/* Fee payment choices */}
                {selectedEvent.feeAmount && Number(selectedEvent.feeAmount) > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <label className="text-sm font-semibold text-fg">
                      Оплата благодійного внеску
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setRegPayment('DONATED')}
                        className={`rounded-2xl border py-2.5 px-3 text-sm font-bold transition-all ${
                          regPayment === 'DONATED'
                            ? 'border-brand-cyan bg-brand-cyan/15 text-brand-cyan'
                            : 'border-border bg-bg/50 text-muted'
                        }`}
                      >
                        Онлайн зараз
                      </button>
                      <button
                        type="button"
                        onClick={() => setRegPayment('AT_EVENT')}
                        className={`rounded-2xl border py-2.5 px-3 text-sm font-bold transition-all ${
                          regPayment === 'AT_EVENT'
                            ? 'border-brand-cyan bg-brand-cyan/15 text-brand-cyan'
                            : 'border-border bg-bg/50 text-muted'
                        }`}
                      >
                        На вході
                      </button>
                    </div>
                    {regErrors.payment && (
                      <span className="text-xs text-red-400">
                        {regErrors.payment}
                      </span>
                    )}

                    {regPayment === 'DONATED' && (
                      <div className="mt-2 space-y-2 rounded-2xl border border-border bg-bg/50 p-3.5">
                        <div className="text-xs text-muted">
                          Реквізити для переказу:
                        </div>
                        <div className="text-sm font-mono font-bold text-brand-cyan break-all">
                          {selectedEvent.feeRequisites || 'Уточнюйте у організаторів'}
                        </div>
                        <label className="block text-xs font-semibold text-fg pt-1">
                          Завантажити скриншот оплати:
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleReceiptUpload}
                          className="text-xs text-muted file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:bg-surface file:text-xs file:font-semibold file:text-fg"
                        />
                        {regUploading && (
                          <div className="text-xs text-muted">
                            Завантаження файлу…
                          </div>
                        )}
                        {regReceiptUrl && (
                          <div className="text-xs text-brand-green font-semibold">
                            ✓ Скриншот додано
                          </div>
                        )}
                        {regErrors.receipt && (
                          <span className="text-xs text-red-400 block">
                            {regErrors.receipt}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Save Profile Checkbox */}
                <label className="flex items-center gap-2.5 pt-2 text-sm text-muted cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={regSaveProfile}
                    onChange={(e) => setRegSaveProfile(e.target.checked)}
                    className="h-5 w-5 rounded accent-brand-cyan cursor-pointer"
                  />
                  <span>Зберегти мої дані для наступних реєстрацій</span>
                </label>

                {/* Consent Checkbox */}
                <div className="flex flex-col gap-1 pt-2">
                  <label className="flex cursor-pointer items-start gap-2.5 text-xs text-subtle leading-relaxed select-none">
                    <input
                      type="checkbox"
                      checked={regConsent}
                      onChange={(e) => setRegConsent(e.target.checked)}
                      className="mt-0.5 size-4 shrink-0 accent-brand-green cursor-pointer"
                    />
                    <span>
                      Погоджуюся на обробку моїх даних та використання фото/відеоматеріалів із моєю участю.
                    </span>
                  </label>
                  {regErrors.consent && (
                    <span className="text-[11px] text-brand-red font-medium">
                      {regErrors.consent}
                    </span>
                  )}
                </div>

                {regSubmitError && (
                  <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400 font-medium leading-relaxed">
                    {regSubmitError.includes('@fice_robot') ? (
                      <>
                        {regSubmitError.split('@fice_robot')[0]}
                        <a
                          href="https://t.me/fice_robot"
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold underline text-brand-cyan hover:text-white"
                        >
                          @fice_robot
                        </a>
                        {regSubmitError.split('@fice_robot')[1]}
                      </>
                    ) : (
                      regSubmitError
                    )}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={regSubmitting || regUploading}
                  className="w-full text-sm font-black py-3.5 mt-3 rounded-2xl shadow-glow-cyan"
                >
                  {regSubmitting ? 'Реєстрація…' : 'Зареєструватися'}
                </Button>
              </form>
            )}
          </div>
        ) : null}

        {/* ================= VIEW: EVENTS CATALOG TAB ================= */}
        {!selectedEventId && activeTab === 'events' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-muted">
                Майбутні події
              </h2>
              <span className="text-sm text-brand-cyan font-bold">
                {pluralizeEvents(events.length)}
              </span>
            </div>

            {isLoadingEvents ? (
              <div className="py-16 text-center text-muted text-sm">
                Завантаження афіші…
              </div>
            ) : events.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border p-8 text-center text-xs text-muted">
                Зараз немає запланованих заходів. Слідкуй за анонсами у нашому Telegram-каналі!
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => {
                      haptic('light');
                      setSelectedEventId(ev.id);
                    }}
                    className="group relative cursor-pointer overflow-hidden rounded-3xl border border-border bg-surface p-3.5 sm:p-4 transition-all hover:border-brand-cyan/60 active:scale-[0.99] flex flex-col justify-between"
                  >
                    <div>
                      {ev.photoUrl ? (
                        <div className="relative mb-3 h-32 sm:h-40 w-full overflow-hidden rounded-2xl border border-white/5 bg-surface">
                          <img
                            src={mediaUrl(ev.photoUrl) || ev.photoUrl}
                            alt={ev.name}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <span className="absolute top-2 right-2 rounded-full border border-border/80 bg-black/80 px-2.5 py-1 text-xs font-bold text-brand-green backdrop-blur-md">
                            {ev.feeAmount && Number(ev.feeAmount) > 0
                              ? `${Number(ev.feeAmount)} грн`
                              : 'Вільний'}
                          </span>
                        </div>
                      ) : (
                        <div className="relative mb-3 h-32 sm:h-40 w-full rounded-2xl border border-border/40 bg-surface/60 flex items-center justify-center text-muted">
                          <span className="absolute top-2 right-2 rounded-full border border-border/80 bg-black/80 px-2.5 py-1 text-xs font-bold text-brand-green backdrop-blur-md">
                            {ev.feeAmount && Number(ev.feeAmount) > 0
                              ? `${Number(ev.feeAmount)} грн`
                              : 'Вільний'}
                          </span>
                        </div>
                      )}

                      <h3 className="text-sm sm:text-base font-black text-fg group-hover:text-brand-cyan transition-colors line-clamp-2 leading-snug">
                        {ev.name}
                      </h3>
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-brand-cyan">
                        <svg
                          className="h-3.5 w-3.5 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="truncate">
                          {fmtDate(ev.date, ev.hasTime, ev.time)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted truncate">
                        <svg
                          className="h-3.5 w-3.5 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span className="truncate">
                          {ev.location?.trim()
                            ? ev.location.trim()
                            : 'Локація: буде повідомлено згодом'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-between items-center border-t border-border/60 pt-2 text-xs font-bold text-fg group-hover:text-brand-cyan">
                      <span>Деталі</span>
                      <span>→</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= VIEW: MY REGISTRATIONS TAB ================= */}
        {!selectedEventId && activeTab === 'my-events' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-muted">
                Мої реєстрації
              </h2>
            </div>

            {isLoadingMy ? (
              <div className="py-16 text-center text-muted text-sm">
                Завантаження ваших реєстрацій…
              </div>
            ) : myRegistrations.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border p-8 text-center space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-muted border border-border">
                  <svg
                    className="h-7 w-7"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                    />
                  </svg>
                </div>
                <div className="text-sm font-bold text-fg">
                  Ти ще не зареєстрований на жоден захід
                </div>
                <p className="text-xs text-muted">
                  Переглянь афішу та обери цікаву для себе подію!
                </p>
                <Button
                  onClick={() => setActiveTab('events')}
                  className="mt-2 text-xs font-bold py-2.5 px-4"
                >
                  Відкрити афішу
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {myRegistrations.map((reg) => (
                  <div
                    key={reg.id}
                    className="rounded-3xl border border-border bg-surface p-4 sm:p-5 space-y-3.5"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-brand-cyan">
                          Реєстрація учасника
                        </span>
                        <h3 className="text-lg font-black text-fg mt-0.5 leading-snug">
                          {reg.event.name}
                        </h3>
                        <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-muted">
                          <svg
                            className="h-4 w-4 shrink-0 text-brand-cyan"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <span>
                            {fmtDate(
                              reg.event.date,
                              (reg.event as any).hasTime,
                              (reg.event as any).time,
                            )}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                          reg.payment === 'DONATED'
                            ? 'bg-brand-green/20 text-brand-green border border-brand-green/30'
                            : reg.payment === 'AT_EVENT'
                            ? 'bg-brand-purple/20 text-brand-purple border border-brand-purple/30'
                            : 'bg-white/10 text-fg border border-white/10'
                        }`}
                      >
                        {reg.payment === 'DONATED'
                          ? 'Оплачено'
                          : reg.payment === 'AT_EVENT'
                          ? 'Оплата на вході'
                          : 'Зареєстровано'}
                      </span>
                    </div>

                    <div className="rounded-2xl bg-bg/60 p-3.5 text-sm space-y-1.5 text-muted">
                      <div>
                        Учасник: <b className="text-fg">{reg.fullName}</b>
                      </div>
                      <div>
                        Група: <b className="text-fg">{reg.group}</b>
                      </div>
                      <div>
                        Telegram: <b className="text-brand-cyan font-semibold">{reg.telegramTag}</b>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedEventId(reg.eventId);
                        }}
                        className="flex-1 text-xs font-bold py-2.5"
                      >
                        Інформація заходу
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= VIEW: PROFILE TAB ================= */}
        {!selectedEventId && activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="px-1">
              <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-muted">
                Мій профіль
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Збережені дані автоматично підставлятимуться при кожній реєстрації
              </p>
            </div>

            {profileSavedMsg && (
              <div className="rounded-2xl border border-brand-green/40 bg-brand-green/10 p-3.5 text-sm text-brand-green font-semibold">
                ✓ Профіль успішно оновлено!
              </div>
            )}

            <form
              onSubmit={handleSaveProfile}
              className="rounded-3xl border border-border bg-surface p-5 space-y-3.5"
            >
              <Input
                label="ПІБ"
                placeholder="Іваненко Іван Іванович"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                required
              />

              <Input
                label="Академічна група"
                placeholder="ІП-31"
                value={profileGroup}
                onChange={(e) => setProfileGroup(e.target.value)}
                required
              />

              <Input
                label="Дата народження"
                type="date"
                value={profileBirthDate}
                onChange={(e) => setProfileBirthDate(e.target.value)}
              />

              <Input
                label="Телефон (опціонально)"
                placeholder="+380..."
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
              />

              {profileSavedMsg && (
                <div className="animate-in fade-in zoom-in-95 duration-200 rounded-2xl border border-emerald-500/50 bg-emerald-500/15 p-3.5 text-center text-sm text-emerald-400 font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  <span className="text-lg">✓</span>
                  <span>Дані профілю успішно збережено!</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={isProfileSaving}
                className={cn(
                  "w-full text-sm font-black py-3.5 mt-2 rounded-2xl transition-all duration-300",
                  profileSavedMsg
                    ? "bg-emerald-500 text-black border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.4)]"
                    : "shadow-glow-cyan"
                )}
              >
                {profileSavedMsg
                  ? '✓ Збережено!'
                  : isProfileSaving
                  ? 'Збереження…'
                  : 'Зберегти зміни'}
              </Button>
            </form>
          </div>
        )}
      </main>

      {/* ================= BOTTOM NAVIGATION BAR ================= */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 border-t border-border/80 bg-bg/95 px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        <div className="flex justify-around items-center">
          <button
            onClick={() => {
              haptic('light');
              setSelectedEventId(null);
              setActiveTab('events');
            }}
            className={`flex flex-col items-center gap-1.5 text-xs font-bold transition-colors py-1 ${
              activeTab === 'events' && !selectedEventId
                ? 'text-brand-cyan'
                : 'text-muted hover:text-fg'
            }`}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>Афіша</span>
          </button>

          <button
            onClick={() => {
              haptic('light');
              setSelectedEventId(null);
              setActiveTab('my-events');
            }}
            className={`flex flex-col items-center gap-1.5 text-xs font-bold transition-colors relative py-1 ${
              activeTab === 'my-events'
                ? 'text-brand-cyan'
                : 'text-muted hover:text-fg'
            }`}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
              />
            </svg>
            <span>Мої заходи</span>
            {myRegistrations.length > 0 && (
              <span className="absolute -top-1 right-1 h-4 w-4 rounded-full bg-brand-green text-[10px] text-black font-black flex items-center justify-center">
                {myRegistrations.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              haptic('light');
              setSelectedEventId(null);
              setActiveTab('profile');
            }}
            className={`flex flex-col items-center gap-1.5 text-xs font-bold transition-colors py-1 ${
              activeTab === 'profile'
                ? 'text-brand-cyan'
                : 'text-muted hover:text-fg'
            }`}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span>Профіль</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default function MiniAppPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg text-muted text-sm">
          Завантаження…
        </div>
      }
    >
      <MiniAppContent />
    </Suspense>
  );
}
