// frontend/src/store/useAchievementStore.js

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAchievementStore = create(
    persist(
        (set, get) => ({
            // Зберігаємо останні відомі досягнення для порівняння
            lastKnownAchievements: null,
            // Флаг для показу значка нових досягнень
            hasUnseenAchievements: false,

            // Перевіряємо нові досягнення
            checkForNewAchievements: (currentAchievements) => {
                const { lastKnownAchievements } = get();

                if (!lastKnownAchievements || !currentAchievements) {
                    // Перший раз або немає досягнень - зберігаємо поточний стан
                    set({
                        lastKnownAchievements: JSON.parse(JSON.stringify(currentAchievements)),
                        hasUnseenAchievements: false
                    });
                    return false;
                }

                // Перевіряємо чи є нові розблоковані досягнення
                let hasNewAchievements = false;

                Object.keys(currentAchievements).forEach(groupKey => {
                    const currentGroup = currentAchievements[groupKey];
                    const lastGroup = lastKnownAchievements[groupKey];

                    if (lastGroup) {
                        currentGroup.achievements.forEach(achievement => {
                            const lastAchievement = lastGroup.achievements.find(a => a.id === achievement.id);

                            // Якщо досягнення було розблоковано зараз, але не було раніше
                            if (achievement.isUnlocked && lastAchievement && !lastAchievement.isUnlocked) {
                                hasNewAchievements = true;
                            }
                        });
                    }
                });

                if (hasNewAchievements) {
                    set({ hasUnseenAchievements: true });
                }

                // Оновлюємо збережені досягнення
                set({
                    lastKnownAchievements: JSON.parse(JSON.stringify(currentAchievements))
                });

                return hasNewAchievements;
            },

            // Позначаємо досягнення як переглянуті (коли користувач відкрив сторінку профілю)
            markAchievementsAsSeen: () => {
                set({ hasUnseenAchievements: false });
            },
        }),
        {
            name: "achievement-storage", // назва для localStorage
            partialize: (state) => ({
                lastKnownAchievements: state.lastKnownAchievements,
                hasUnseenAchievements: state.hasUnseenAchievements
            })
        }
    )
);