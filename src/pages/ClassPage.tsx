import { useEffect, useMemo, useState } from "react";
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonChip,
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
  type AttendanceScanType,
  type ClassModerator,
  type Student,
  type ScanType,
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
  const studentId =
    findVal(/^(student\s*id)$/i) ||
    findVal(/\bstudent\s*id\b/i) ||
    findVal(/^id$/i) ||
    findVal(/^code$/i);
  // Name detection: "name", "student name", Google Forms header variant with parentheses
  const name =
    findVal(/^name$/i) ||
    findVal(/^student\s*name$/i) ||
    findVal(/student\s*name.*lastname.*firstname/i) ||
    findVal(/\(lastname,\s*firstname/i);
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
  const [tab, setTab] = useState<string>("attendance");
  const [attendance, setAttendance] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [moderators, setModerators] = useState<ClassModerator[]>([]);
  const [scanTypes, setScanTypes] = useState<ScanType[]>([]);
  const [newScanTypeName, setNewScanTypeName] = useState<string>("");

  useEffect(() => {
    if (!classId) return;
    listAttendance(classId, 500)
      .then(setAttendance)
      .catch((e) => present({ message: e.message, duration: 2000, color: "danger" }));
    listStudents(classId)
      .then(setStudents)
      .catch((e) => present({ message: e.message, duration: 2000, color: "danger" }));
    listModerators(classId)
      .then(setModerators)
      .catch((e) => present({ message: e.message, duration: 2000, color: "danger" }));
    listScanTypes(classId)
      .then(setScanTypes)
      .catch((e) => present({ message: e.message, duration: 2000, color: "danger" }));
  }, [classId]);

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
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
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
        const rows = (data as any[])
          .map((r) => extractStudentRow(r as Record<string, any>))
          .filter((r): r is { student_id: string; name: string } => !!r);
        const cnt = await bulkAddStudents(classId, rows);
        present({ message: `Imported ${cnt} students`, duration: 1600, color: "success" });
        setStudents(await listStudents(classId));
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { raw: false });
        const rows = (json as any[])
          .map((r) => extractStudentRow(r as Record<string, any>))
          .filter((r): r is { student_id: string; name: string } => !!r);
        const cnt = await bulkAddStudents(classId, rows);
        present({ message: `Imported ${cnt} students`, duration: 1600, color: "success" });
        setStudents(await listStudents(classId));
      }
    } catch (e: any) {
      present({ message: e.message ?? "Import failed", duration: 2000, color: "danger" });
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => history.goBack()}>Back</IonButton>
          </IonButtons>
          <IonTitle>Class</IonTitle>
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
          <IonSegment
            value={tab}
            onIonChange={(e) => setTab((e.detail.value as string) || "attendance")}
          >
            <IonSegmentButton value="attendance">Attendance</IonSegmentButton>
            <IonSegmentButton value="students">Students</IonSegmentButton>
            <IonSegmentButton value="moderators">Moderators</IonSegmentButton>
            <IonSegmentButton value="scanTypes">Scan Types</IonSegmentButton>
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
                    {a.type}
                    {a.note ? ` - ${a.note}` : ""}
                  </h3>
                  <p>
                    {new Date(a.created_at).toLocaleString()} • {a.students?.name ?? ""} (
                    {a.students?.student_id ?? a.scanned_value})
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
                <IonInput
                  placeholder="e.g. Morning IN"
                  value={newScanTypeName}
                  onIonInput={(e) => setNewScanTypeName(e.detail.value ?? "")}
                />
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
      </IonContent>
    </IonPage>
  );
};

export default ClassPage;
