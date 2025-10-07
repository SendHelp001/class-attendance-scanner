import { supabase } from "./SupabaseClient";

export type UUID = string;

export type AttendanceScanType = "IN" | "OUT" | "CUSTOM";

export interface ClassRoom {
    id: UUID;
    owner_id: UUID;
    name: string;
    code: string; // share code
    created_at: string;
}

export interface ClassModerator {
    id: UUID;
    class_id: UUID;
    user_id: UUID;
    created_at: string;
}

export interface Student {
    id: UUID;
    class_id: UUID;
    student_id: string; // barcode content
    name: string;
    created_at: string;
}

// 💡 CORRECTED INTERFACE: Added 'scanned_value' and made 'student_id' nullable
export interface AttendanceRecord {
    id: UUID;
    class_id: UUID;
    student_id: UUID | null; // FK to Student.id, made nullable
    type: AttendanceScanType;
    scanned_value: string; // 💡 ADDED: The raw scanned value
    scanned_by: UUID; // user id
    note: string | null;
    created_at: string;
}

export interface ClassLog {
    id: UUID;
    class_id: UUID;
    user_id: UUID;
    action: string;
    metadata: Record<string, any> | null;
    created_at: string;
}

export async function getCurrentUserId(): Promise<UUID | null> {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
}

export async function createClass(name: string): Promise<ClassRoom> {
    const ownerId = await getCurrentUserId();
    if (!ownerId) throw new Error("Not authenticated");
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const { data, error } = await supabase
        .from("classes")
        .insert({ name, owner_id: ownerId, code })
        .select()
        .single();
    if (error) throw error;
    return data as ClassRoom;
}

export async function listMyClasses(): Promise<ClassRoom[]> {
    const userId = await getCurrentUserId();
    if (!userId) return [];
    const { data, error } = await supabase.rpc("list_user_classes", { p_user_id: userId });
    if (error) throw error;
    return data as ClassRoom[];
}

export async function addModerator(classId: UUID, userId: UUID): Promise<void> {
    const { error } = await supabase.from("class_moderators").insert({ class_id: classId, user_id: userId });
    if (error) throw error;
}

export async function removeModerator(classId: UUID, userId: UUID): Promise<void> {
    const { error } = await supabase.from("class_moderators").delete().match({ class_id: classId, user_id: userId });
    if (error) throw error;
}

export async function addStudent(classId: UUID, studentId: string, name: string): Promise<Student> {
    const { data, error } = await supabase
        .from("students")
        .insert({ 
            class_id: classId, 
            student_id: studentId, // barcode content
            name 
        })
        .select()
        .single();
    if (error) throw error;
    return data as Student;
}

export async function listStudents(classId: UUID): Promise<Student[]> {
    const { data, error } = await supabase.from("students").select("*").eq("class_id", classId).order("name");
    if (error) throw error;
    return data as Student[];
}

export async function scanAttendance(
    classId: UUID,
    scannedStudentIdValue: string,
    type: AttendanceScanType,
    note?: string
): Promise<{ record: AttendanceRecord; student: Student | null }> {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error("Not authenticated");
    
    const { data: students, error: sErr } = await supabase
        .from("students")
        .select("*")
        .eq("class_id", classId)
        .eq("student_id", scannedStudentIdValue)
        .limit(1);
    
    if (sErr) throw sErr;
    
    const student = students?.[0] ?? null;
    
    const { data, error } = await supabase
        .from("attendance")
        .insert({
            class_id: classId,
            student_id: student ? student.id : null,
            scanned_value: scannedStudentIdValue, // This value is now properly tracked in the interface
            type,
            scanned_by: userId,
            note: note ?? null,
        })
        .select()
        .single();
    
    if (error) throw error;
    
    // Write a log entry
    await supabase.from("class_logs").insert({
        class_id: classId,
        user_id: userId,
        action: "scan",
        metadata: { type, scannedStudentIdValue, matchedStudent: !!student },
    });
    
    return { record: data as AttendanceRecord, student };
}

export async function listAttendance(classId: UUID, limit: number = 100) {
    const { data, error } = await supabase
        .from("attendance")
        .select("*, students(name, student_id)")
        .eq("class_id", classId)
        .order("created_at", { ascending: false })
        .limit(limit);
    if (error) throw error;
    return data;
}

export async function listLogs(classId: UUID, limit: number = 200): Promise<ClassLog[]> {
    const { data, error } = await supabase
        .from("class_logs")
        .select("*")
        .eq("class_id", classId)
        .order("created_at", { ascending: false })
        .limit(limit);
    if (error) throw error;
    return data as ClassLog[];
}