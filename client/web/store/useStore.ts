// web/store/useStore.ts
import { create } from 'zustand';
import { TeamMember, AboutSection, Event, CharityCampaign, Partner } from '../app/types'; //

interface AppState {
    members: TeamMember[];
    aboutInfo: AboutSection | null;
    events: Event[];
    charity: CharityCampaign[];
    partners: Partner[];

    setMembers: (members: TeamMember[]) => void;
    setAboutInfo: (info: AboutSection) => void; 
    setEvents: (events: Event[]) => void;
    setCharity: (charity: CharityCampaign[]) => void;
    setPartners: (partners: Partner[]) => void;
}

export const useStore = create<AppState>((set) => ({
    members: [],
    aboutInfo: null,
    events: [],
    charity: [],
    partners: [], 

    setMembers: (members) => set({ members }),
    setAboutInfo: (info) => set({ aboutInfo: info }),
    setEvents: (events) => set({ events }),
    setCharity: (charity) => set({ charity }),
    setPartners: (partners) => set({ partners }),
}));