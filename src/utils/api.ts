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
    profiles?: { display_name?: string | null; email?: string | null };
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
    student_id: UUID | null;
    type?: AttendanceScanType; // legacy enum
    type_id?: UUID | null; // new FK to scan_types
    scanned_value: string;
    scanned_by: UUID;
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

export interface Profile {
	 id: UUID;
	 email?: string | null;
	 display_name?: string | null;
	 created_at?: string;
}

export interface ScanType {
    id: UUID;
    class_id: UUID;
    name: string;
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

export async function listModerators(classId: UUID): Promise<ClassModerator[]> {
	 const { data, error } = await supabase
		 .from("class_moderators")
		 .select("id, class_id, user_id, created_at, profiles:profiles(display_name, email)")
		 .eq("class_id", classId)
		 .order("created_at", { ascending: true });
	 if (error) throw error;
	 return data as ClassModerator[];
}

export async function joinClassByCode(code: string): Promise<ClassRoom> {
	 const userId = await getCurrentUserId();
	 if (!userId) throw new Error("Not authenticated");
	 const { data: cls, error: cErr } = await supabase.from("classes").select("*").eq("code", code).single();
	 if (cErr) throw cErr;
	 // Insert moderator if not exists
	 const { error: mErr } = await supabase.from("class_moderators").insert({ class_id: cls.id, user_id: userId }).select().single();
	 // If conflict due to unique, ignore
	 if (mErr && !String(mErr.message || "").includes("duplicate")) throw mErr;
	 return cls as ClassRoom;
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

export async function bulkAddStudents(classId: UUID, rows: Array<{ student_id: string; name: string }>): Promise<number> {
	 if (!rows.length) return 0;
	 const payload = rows.map(r => ({ class_id: classId, student_id: r.student_id, name: r.name }));
	 const { error, count } = await supabase
		 .from("students")
		 .upsert(payload, { onConflict: "class_id,student_id", ignoreDuplicates: true, count: 'exact' as any });
	 if (error) throw error;
	 return count ?? rows.length;
}

export async function scanAttendance(
    classId: UUID,
    scannedStudentIdValue: string,
    typeOrTypeId: AttendanceScanType | UUID,
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
    
    const isTypeId = typeof typeOrTypeId === 'string' && typeOrTypeId.length > 20;
    const insertPayload: any = {
        class_id: classId,
        student_id: student ? student.id : null,
        scanned_value: scannedStudentIdValue,
        scanned_by: userId,
        note: note ?? null,
    };
    if (isTypeId) insertPayload.type_id = typeOrTypeId as UUID; else insertPayload.type = typeOrTypeId as AttendanceScanType;
    const { data, error } = await supabase
        .from("attendance")
        .insert(insertPayload)
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
		 .select("*, students(name, student_id), scan_types(name)")
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

export async function getMyProfile(): Promise<Profile | null> {
	 const uid = await getCurrentUserId();
	 if (!uid) return null;
	 const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
	 if (error) throw error;
	 return data as Profile;
}

export async function updateMyProfile(update: Partial<Profile>): Promise<Profile> {
	 const uid = await getCurrentUserId();
	 if (!uid) throw new Error('Not authenticated');
	 const payload: any = { ...update, id: uid };
	 const { data, error } = await supabase.from('profiles').upsert(payload).select().single();
	 if (error) throw error;
	 return data as Profile;
}

export async function listScanTypes(classId: UUID): Promise<ScanType[]> {
    const { data, error } = await supabase.from('scan_types').select('*').eq('class_id', classId).order('created_at', { ascending: true });
    if (error) throw error;
    return data as ScanType[];
}

export async function addScanType(classId: UUID, name: string): Promise<ScanType> {
    const { data, error } = await supabase.from('scan_types').insert({ class_id: classId, name }).select().single();
    if (error) throw error;
    return data as ScanType;
}

export async function deleteScanType(typeId: UUID): Promise<void> {
    const { error } = await supabase.from('scan_types').delete().eq('id', typeId);
    if (error) throw error;
}