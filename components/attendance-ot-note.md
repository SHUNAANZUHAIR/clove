# OT UI wiring

The component `components/AttendancePanel.tsx` has OT in/out fields.

To finish wiring, in `pages/index.tsx`:

1. Add after lucide-react import:
```
import { AttendancePanel } from '../components/AttendancePanel';
```

2. Rename local `function AttendancePanel` to `function LegacyAttendancePanel` (so the import is used by JSX).

3. Add to AttendanceRecord interface:
```
  ot_in_time: string | null;
  ot_out_time: string | null;
```

4. In fetchAttendance map add:
```
        ot_in_time: friday ? null : record.ot_in_time || null,
        ot_out_time: friday ? null : record.ot_out_time || null,
```
