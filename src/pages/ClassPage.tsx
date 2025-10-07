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
  IonAlert, // Import IonAlert for confirmation dialog
} from "@ionic/react";
import { downloadOutline, personRemoveOutline } from "ionicons/icons";
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
  getClassDetails, // << ADDED
  updateClass, // << ADDED
  deleteClass, // << ADDED
  type AttendanceScanType,
  type ClassModerator,
  type Student,
  type ScanType,
  type Class, // << ADDED
} from "../utils/api";
import Papa from "papaparse";
import * as XLSX from "xlsx";

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
  // ID detection: "student id", "id", "code"
  const studentId = findVal(/^(student\s*id)$/i) || findVal(/\bstudent\s*id\b/i) || findVal(/^id$/i) || findVal(/^code$/i);
  // Name detection: "name", "student name", Google Forms header variant with parentheses
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

  const [tab, setTab] = useState<string>("attendance");
  const [attendance, setAttendance] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [moderators, setModerators] = useState<ClassModerator[]>([]);
  const [scanTypes, setScanTypes] = useState<ScanType[]>([]);
  const [newScanTypeName, setNewScanTypeName] = useState<string>("");

  // Function to fetch all class-related data
  const fetchClassData = async (id: string) => {
    if (!id) return;
    try {
      // Fetch Class Details
      const details = await getClassDetails(id);
      setClassDetails(details);
      setEditClassName(details.name); // Initialize rename field

      // Fetch other data
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
          </IonTitle>{" "}
          {/* Display class name/code */}
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
          <IonSegment value={tab} onIonChange={(e) => setTab((e.detail.value as string) || "attendance")}>
            <IonSegmentButton value="attendance">Attendance</IonSegmentButton>
            <IonSegmentButton value="students">Students</IonSegmentButton>
            <IonSegmentButton value="moderators">Moderators</IonSegmentButton>
            <IonSegmentButton value="scanTypes">Scan Types</IonSegmentButton>
            <IonSegmentButton value="settings">Settings</IonSegmentButton>
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
                  {moderators.map((m) => (
                    <IonItem key={m.id} lines="full">
                      <IonLabel>
                        <p>{m.profiles?.display_name || m.profiles?.email || m.user_id}</p>
                      </IonLabel>
                      <IonButton
                        slot="end"
                        color="danger"
                        fill="clear"
                        onClick={async () => {
                          try {
                            await removeModerator(classId, m.user_id);
                            setModerators(await listModerators(classId));
                            present({ message: "Removed", duration: 1000 });
                          } catch (e: any) {
                            present({ message: e.message, duration: 2000, color: "danger" });
                          }
                        }}
                      >
                        <IonIcon slot="icon-only" icon={personRemoveOutline} />
                      </IonButton>
                    </IonItem>
                  ))}
                </IonList>
              </IonCardContent>
            </IonCard>
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
                {/* Rename Class */}
                <IonItem lines="full">
                  <IonLabel position="stacked">Rename Class</IonLabel>
                  <IonInput value={editClassName} placeholder="New Class Name" onIonChange={(e) => setEditClassName(e.detail.value ?? "")} />
                  <IonButton slot="end" onClick={handleRenameClass} disabled={!editClassName.trim() || editClassName.trim() === classDetails.name}>
                    Save
                  </IonButton>
                </IonItem>

                {/* Class Code (Read-only for simplicity, can be made editable) */}
                <IonItem lines="full">
                  <IonLabel>Class Code</IonLabel>
                  <IonInput value={classDetails.code} readonly />
                </IonItem>

                {/* Delete Class */}
                <IonItem lines="full">
                  <IonLabel color="danger">Delete Class</IonLabel>
                  <IonButton slot="end" color="danger" onClick={() => setShowDeleteAlert(true)}>
                    Delete
                  </IonButton>
                </IonItem>
              </IonList>
            </IonCardContent>
            {/* Delete Confirmation Alert */}
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
