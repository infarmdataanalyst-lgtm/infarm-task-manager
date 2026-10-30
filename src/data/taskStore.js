// Pintu masuk lapisan data. Memilih penyimpanan sesuai STORAGE_MODE (config.js):
// - "supabase": database bersama (kalau REACT_APP_SUPABASE_URL & key diatur)
// - "local": localStorage browser (mode uji coba)
// Komponen dan taskActions.js hanya memakai fungsi dari file ini.

import { STORAGE_MODE } from "../config";
import * as local from "./localStore";
import * as remote from "./supabaseStore";

const impl = STORAGE_MODE === "supabase" ? remote : local;

export const StorageFullError = local.StorageFullError;
export const listTasks = (...a) => impl.listTasks(...a);
export const getTask = (...a) => impl.getTask(...a);
export const subscribe = (...a) => impl.subscribe(...a);
export const createTask = (...a) => impl.createTask(...a);
export const updateTask = (...a) => impl.updateTask(...a);
export const listHistory = (...a) => impl.listHistory(...a);
export const addChecklistItem = (...a) => impl.addChecklistItem(...a);
export const updateChecklistItem = (...a) => impl.updateChecklistItem(...a);
export const removeChecklistItem = (...a) => impl.removeChecklistItem(...a);
