
import { UserPreferences } from './types';

// Updated key to reflect new structure and avoid conflicts with old versions.
const LOCAL_STORAGE_USER_PREFERENCES_KEY = 'markieRememberedFacts_v1'; 

export const loadUserPreferences = (): UserPreferences => {
  try {
    const serializedPrefs = localStorage.getItem(LOCAL_STORAGE_USER_PREFERENCES_KEY);
    if (serializedPrefs) {
      const parsed = JSON.parse(serializedPrefs);
      // Basic validation for the new structure
      if (typeof parsed === 'object' && parsed !== null && typeof parsed.rememberedFacts === 'object' && parsed.rememberedFacts !== null) {
        return {
            rememberedFacts: parsed.rememberedFacts
        };
      }
    }
  } catch (error) {
    console.error("Failed to load user preferences from localStorage:", error);
  }
  // Return default empty facts if nothing found or error
  return { rememberedFacts: {} };
};

export const saveUserPreferences = (prefs: UserPreferences): void => {
  try {
    // Ensure we are saving the correct structure
    if (typeof prefs === 'object' && prefs !== null && typeof prefs.rememberedFacts === 'object' && prefs.rememberedFacts !== null) {
      localStorage.setItem(LOCAL_STORAGE_USER_PREFERENCES_KEY, JSON.stringify(prefs));
    } else {
      console.warn("Attempted to save invalid preferences structure:", prefs);
      // Optionally, save a default empty structure to prevent further errors
      localStorage.setItem(LOCAL_STORAGE_USER_PREFERENCES_KEY, JSON.stringify({ rememberedFacts: {} }));
    }
  } catch (error) {
    console.error("Failed to save user preferences to localStorage:", error);
  }
};

/**
 * Updates a specific fact in the rememberedFacts.
 * If value is null, the fact is removed.
 */
export const updateRememberedFact = (
  currentFacts: Record<string, string>,
  key: string,
  value: string | null
): Record<string, string> => {
  const newFacts = { ...currentFacts };
  if (value === null) {
    delete newFacts[key];
  } else {
    newFacts[key] = value;
  }
  return newFacts;
};


/**
 * Clears all remembered facts from UserPreferences and localStorage.
 * Returns a UserPreferences object with empty facts.
 */
export const clearAllRememberedFacts = (): UserPreferences => {
  const newPrefs = { rememberedFacts: {} };
  try {
    // Remove the specific key from localStorage
    localStorage.removeItem(LOCAL_STORAGE_USER_PREFERENCES_KEY);
  } catch (error) {
    console.error("Failed to clear user preferences (remembered facts) from localStorage:", error);
  }
  // It's good practice to still explicitly save the empty state if other parts of the app
  // rely on saveUserPreferences being called.
  saveUserPreferences(newPrefs); 
  return newPrefs;
};
