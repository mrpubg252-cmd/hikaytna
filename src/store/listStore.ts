import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Series } from "../lib/data";

interface ListStore {
  myList: Series[];
  addToList: (series: Series) => void;
  removeFromList: (id: string) => void;
  clearList: () => void;
  isInList: (id: string) => boolean;
}

export const useListStore = create<ListStore>()(
  persist(
    (set, get) => ({
      myList: [],
      addToList: (series) => {
        if (!get().isInList(series.id)) {
          set({ myList: [...get().myList, series] });
        }
      },
      removeFromList: (id) => {
        set({ myList: get().myList.filter((s) => s.id !== id) });
      },
      clearList: () => {
        set({ myList: [] });
      },
      isInList: (id) => {
        return get().myList.some((s) => s.id === id);
      },
    }),
    {
      name: "hikayatuna-list",
    }
  )
);
