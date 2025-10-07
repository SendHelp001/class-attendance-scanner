import { useEffect, useMemo, useState } from "react";
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  useIonToast,
  IonAlert,
} from "@ionic/react";
import { downloadOutline, personRemoveOutline, lockClosedOutline } from "ionicons/icons";
import { useHistory, useLocation } from "react-router-dom";
import {
  bulkAddStudents,
  listAttendance,
  listModerators,
  listStudents,
  removeModerator,
  listScanTypes,
  addScanType,
  deleteScanType,
  getClassDetails,
  updateClass,
  deleteClass,
  type AttendanceScanType,
  type ClassModerator,
  type Student,
  type ScanType,
  type Class,
} from "../utils/api";
import { supabase } from "../utils/SupabaseClient";
import Papa from "papaparse";
import * as XLSX from "xlsx";

// CSS for scrollable segment and spacing
const tabSegmentStyle = {
  "--padding-start": "16px",
  "--padding-end": "16px",
  overflowX: "scroll",
  flexWrap: "nowrap",
};

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function extractStudentRow(raw: Record<string, any>): { student_id: string; name: string } | null {
  if (!raw) return null;
  const entries = Object.entries(raw);
  const findVal = (re: RegExp): string => {
    for (const [k, v] of entries) {
      if (re.test(String(k))) return String(v ?? "").trim();
    }
    return "";
  };

  const studentId = findVal(/^(student\s*id)$/i) || findVal(/\bstudent\s*id\b/i) || findVal(/^id$/i) || findVal(/^code$/i);

  const name = findVal(/^name$/i) || findVal(/^student\s*name$/i) || findVal(/student\s*name.*lastname.*firstname/i) || findVal(/\(lastname,\s*firstname/i);
  const sid = String(studentId || "").trim();
  const nm = String(name || "").trim();
  if (!sid || !nm) return null;
  return { student_id: sid, name: nm };
}

const ClassPage: React.FC = () => {
  const [present] = useIonToast();
  const query = useQuery();
  const history = useHistory();
  const classId = query.get("id") || "";

  const [classDetails, setClassDetails] = useState<Class | null>(null);
  const [editClassName, setEditClassName] = useState<string>("");
  const [showDeleteAlert, setShowDeleteAlert] = useState<boolean>(false);

  const [showRemoveModeratorAlert, setShowRemoveModeratorAlert] = useState<boolean>(false);
  const [moderatorToRemove, setModeratorToRemove] = useState<ClassModerator | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); // Current user's ID

  const [tab, setTab] = useState<string>("attendance");
  const [attendance, setAttendance] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [moderators, setModerators] = useState<ClassModerator[]>([]);
  const [scanTypes, setScanTypes] = useState<ScanType[]>([]);
  const [newScanTypeName, setNewScanTypeName] = useState<string>("");

  // Fetch the current user's ID on load to check for self-removal
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
    };
    fetchUser();
  }, []);

  const fetchClassData = async (id: string) => {
    if (!id) return;
    try {
      const details = await getClassDetails(id);
      setClassDetails(details);
      setEditClassName(details.name);

      listAttendance(id, 500).then(setAttendance);
      listStudents(id).then(setStudents);
      listModerators(id).then(setModerators);
      listScanTypes(id).then(setScanTypes);
    } catch (e: any) {
      present({ message: e.message, duration: 2000, color: "danger" });
    }
  };

  useEffect(() => {
    if (classId) {
      fetchClassData(classId);
    }
  }, [classId]);

  const handleRenameClass = async () => {
    if (!classDetails || !editClassName.trim() || editClassName.trim() === classDetails.name) return;
    try {
      const updatedClass = await updateClass(classId, { name: editClassName.trim() });
      setClassDetails(updatedClass);
      present({ message: "Class renamed successfully! 🎉", duration: 1600, color: "success" });
    } catch (e: any) {
      present({ message: e.message ?? "Failed to rename class", duration: 2000, color: "danger" });
    }
  };

  const handleDeleteClass = async () => {
    try {
      await deleteClass(classId);
      present({ message: "Class deleted successfully! 👋", duration: 1600, color: "success" });
      history.push("/classes");
    } catch (e: any) {
      present({ message: e.message ?? "Failed to delete class", duration: 2000, color: "danger" });
    }
  };

  const confirmRemoveModerator = (moderator: ClassModerator) => {
    setModeratorToRemove(moderator);
    setShowRemoveModeratorAlert(true);
  };

  const handleRemoveModerator = async () => {
    if (!moderatorToRemove) return;
    try {
      await removeModerator(classId, moderatorToRemove.user_id);
      setModerators(await listModerators(classId));
      present({ message: `${moderatorToRemove.profiles?.display_name || "Moderator"} removed`, duration: 1500, color: "success" });
    } catch (e: any) {
      present({ message: e.message, duration: 2000, color: "danger" });
    } finally {
      setModeratorToRemove(null);
      setShowRemoveModeratorAlert(false);
    }
  };

  const exportAttendanceCsv = () => {
    const rows = attendance.map((a) => ({
      Timestamp: new Date(a.created_at).toLocaleString(),
      ClassID: a.class_id,
      Type: a.scan_types?.name || (a.type as AttendanceScanType) || "",
      Note: a.note ?? "",
      StudentName: a.students?.name ?? "",
      StudentID: a.students?.student_id ?? a.scanned_value,
      RecordID: a.id,
    }));
    const csv = Papa.unparse(rows, { quotes: true });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-is-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${classId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportFile = async (file: File) => {
    try {
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
        const rows = (data as any[]).map((r) => extractStudentRow(r as Record<string, any>)).filter((r): r is { student_id: string; name: string } => !!r);
        const cnt = await bulkAddStudents(classId, rows);
        present({ message: `Imported ${cnt} students`, duration: 1600, color: "success" });
        setStudents(await listStudents(classId));
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { raw: false });
        const rows = (json as any[]).map((r) => extractStudentRow(r as Record<string, any>)).filter((r): r is { student_id: string; name: string } => !!r);
        const cnt = await bulkAddStudents(classId, rows);
        present({ message: `Imported ${cnt} students`, duration: 1600, color: "success" });
        setStudents(await listStudents(classId));
      }
    } catch (e: any) {
      present({ message: e.message ?? "Import failed", duration: 2000, color: "danger" });
    }
  };

  if (!classDetails) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Loading Class...</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent></IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => history.goBack()}>Back</IonButton>
          </IonButtons>
          <IonTitle>
            {classDetails.name} ({classDetails.code})
          </IonTitle>
          <IonButtons slot="end">
            {tab === "attendance" && (
              <IonButton onClick={exportAttendanceCsv}>
                <IonIcon slot="start" icon={downloadOutline} />
                Export CSV
              </IonButton>
            )}
          </IonButtons>
        </IonToolbar>
        <IonToolbar>
          <IonSegment scrollable value={tab} onIonChange={(e) => setTab((e.detail.value as string) || "attendance")} style={tabSegmentStyle}>
            <IonSegmentButton value="attendance" style={{ minWidth: "auto", padding: "0 12px" }}>
              Attendance
            </IonSegmentButton>
            <IonSegmentButton value="students" style={{ minWidth: "auto", padding: "0 12px" }}>
              Students
            </IonSegmentButton>
            <IonSegmentButton value="moderators" style={{ minWidth: "auto", padding: "0 12px" }}>
              Moderators
            </IonSegmentButton>
            <IonSegmentButton value="scanTypes" style={{ minWidth: "auto", padding: "0 12px" }}>
              Scan Types
            </IonSegmentButton>
            <IonSegmentButton value="settings" style={{ minWidth: "auto", padding: "0 12px" }}>
              Settings
            </IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {tab === "attendance" && (
          <IonList>
            {attendance.map((a) => (
              <IonItem key={a.id} lines="full">
                <IonLabel>
                  <h3>
                    {a.scan_types?.name || (a.type as AttendanceScanType) || ""}
                    {a.note ? ` - ${a.note}` : ""}
                  </h3>
                  <p>
                    {new Date(a.created_at).toLocaleString()} • {a.students?.name ?? ""} ({a.students?.student_id ?? a.scanned_value})
                  </p>
                </IonLabel>
              </IonItem>
            ))}
          </IonList>
        )}

        {tab === "students" && (
          <IonCard>
            <IonCardContent>
              <input
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportFile(f);
                }}
              />
              <IonList>
                {students.map((s) => (
                  <IonItem key={s.id} lines="full">
                    <IonLabel>
                      <h3>{s.name}</h3>
                      <p>{s.student_id}</p>
                    </IonLabel>
                  </IonItem>
                ))}
              </IonList>
            </IonCardContent>
          </IonCard>
        )}

        {tab === "moderators" && (
          <>
            <IonCard>
              <IonCardContent>
                <h3>Moderators</h3>
                <IonList>
                  {moderators.map((m) => {
                    const displayName = m.profiles?.display_name || m.profiles?.email || m.user_id;

                    const isModeratorOwner = m.user_id === classDetails.owner_id;
                    const isSelf = m.user_id === currentUserId; // Disable removing self

                    return (
                      <IonItem key={m.id} lines="full">
                        <IonLabel>
                          {/* Correctly rendering moderator name and owner tag */}
                          <p>
                            {displayName} {isModeratorOwner && <strong>(Owner)</strong>}
                          </p>
                        </IonLabel>

                        {isModeratorOwner || isSelf ? (
                          <IonIcon slot="end" icon={lockClosedOutline} color="medium" style={{ opacity: 0.7 }} title="Cannot remove self or owner" />
                        ) : (
                          <IonButton slot="end" color="danger" fill="clear" onClick={() => confirmRemoveModerator(m)}>
                            <IonIcon slot="icon-only" icon={personRemoveOutline} />
                          </IonButton>
                        )}
                      </IonItem>
                    );
                  })}
                </IonList>
              </IonCardContent>
            </IonCard>

            {/* Moderator Removal Confirmation Alert */}
            <IonAlert
              isOpen={showRemoveModeratorAlert}
              onDidDismiss={() => setShowRemoveModeratorAlert(false)}
              header={"Confirm Removal"}
              message={`Are you sure you want to remove **${
                moderatorToRemove?.profiles?.display_name || moderatorToRemove?.profiles?.email || moderatorToRemove?.user_id || "this moderator"
              }** from the class? They will lose access.`}
              buttons={[
                {
                  text: "Cancel",
                  role: "cancel",
                },
                {
                  text: "Remove",
                  cssClass: "alert-button-danger",
                  handler: handleRemoveModerator,
                },
              ]}
            />
          </>
        )}

        {tab === "scanTypes" && (
          <IonCard>
            <IonCardContent>
              <h3>Scan Types</h3>
              <IonItem>
                <IonInput placeholder="e.g. Morning IN" value={newScanTypeName} onIonInput={(e) => setNewScanTypeName(e.detail.value ?? "")} />
                <IonButton
                  onClick={async () => {
                    if (!newScanTypeName.trim()) return;
                    try {
                      await addScanType(classId, newScanTypeName.trim());
                      setNewScanTypeName("");
                      setScanTypes(await listScanTypes(classId));
                    } catch (e: any) {
                      present({ message: e.message, duration: 2000, color: "danger" });
                    }
                  }}
                >
                  Add
                </IonButton>
              </IonItem>
              <IonList>
                {scanTypes.map((t) => (
                  <IonItem key={t.id} lines="full">
                    <IonLabel>{t.name}</IonLabel>
                    <IonButton
                      slot="end"
                      color="danger"
                      fill="clear"
                      onClick={async () => {
                        try {
                          await deleteScanType(t.id);
                          setScanTypes(await listScanTypes(classId));
                        } catch (e: any) {
                          present({ message: e.message, duration: 2000, color: "danger" });
                        }
                      }}
                    >
                      Remove
                    </IonButton>
                  </IonItem>
                ))}
              </IonList>
            </IonCardContent>
          </IonCard>
        )}

        {tab === "settings" && (
          <IonCard>
            <IonCardContent>
              <IonList>
                <IonItem lines="full">
                  <IonLabel position="stacked">Rename Class</IonLabel>
                  <IonInput value={editClassName} placeholder="New Class Name" onIonChange={(e) => setEditClassName(e.detail.value ?? "")} />
                  <IonButton slot="end" onClick={handleRenameClass} disabled={!editClassName.trim() || editClassName.trim() === classDetails.name}>
                    Save
                  </IonButton>
                </IonItem>

                <IonItem lines="full">
                  <IonLabel>Class Code</IonLabel>
                  <IonInput value={classDetails.code} readonly />
                </IonItem>

                <IonItem lines="full">
                  <IonLabel color="danger">Delete Class</IonLabel>
                  <IonButton slot="end" color="danger" onClick={() => setShowDeleteAlert(true)}>
                    Delete
                  </IonButton>
                </IonItem>
              </IonList>
            </IonCardContent>
            <IonAlert
              isOpen={showDeleteAlert}
              onDidDismiss={() => setShowDeleteAlert(false)}
              header={"Confirm Deletion"}
              message={`Are you sure you want to delete the class **${classDetails.name}**? This action cannot be undone.`}
              buttons={[
                {
                  text: "Cancel",
                  role: "cancel",
                },
                {
                  text: "Delete",
                  cssClass: "alert-button-danger",
                  handler: handleDeleteClass,
                },
              ]}
            />
          </IonCard>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ClassPage;
