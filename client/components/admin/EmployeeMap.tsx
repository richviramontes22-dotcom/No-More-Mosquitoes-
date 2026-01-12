import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface Employee {
  id: string;
  name: string;
  status: string;
  location: { lat: number; lng: number } | null;
  assignment: {
    id: string;
    customer_name: string;
    address: string;
  } | null;
}

export default function EmployeeMap({ employees }: { employees: Employee[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;

    for (let i = 0; i <= canvas.width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i <= canvas.height; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    const bounds = calculateBounds(employees);
    const scale = calculateScale(bounds, canvas.width, canvas.height);

    employees.forEach((emp, idx) => {
      if (emp.location) {
        const { x, y } = projectCoordinates(emp.location.lat, emp.location.lng, bounds, scale, canvas);

        const isSelected = selectedEmployee?.id === emp.id;

        ctx.fillStyle = isSelected ? "#3b82f6" : emp.status === "in_progress" ? "#10b981" : "#f59e0b";
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = isSelected ? "#1e40af" : "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#1f2937";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(emp.name.split(" ")[0], x, y + 20);
      }
    });
  }, [employees, selectedEmployee]);

  const activeEmployees = employees.filter(
    (e) => e.status === "en_route" || e.status === "in_progress"
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Live Map</h3>
          <canvas
            ref={canvasRef}
            className="h-96 w-full rounded-lg bg-background cursor-pointer border border-border/50"
          />
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Active Employees</h3>
          <div className="space-y-3">
            {activeEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active employees</p>
            ) : (
              activeEmployees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmployee(emp)}
                  className={`w-full rounded-lg p-3 text-left transition ${
                    selectedEmployee?.id === emp.id
                      ? "bg-primary/20 border border-primary"
                      : "bg-muted/50 hover:bg-muted border border-border/50"
                  }`}
                >
                  <p className="font-semibold text-sm">{emp.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {emp.assignment?.customer_name || "—"}
                  </p>
                  <Badge className="mt-2 text-xs" variant={emp.status === "in_progress" ? "default" : "secondary"}>
                    {emp.status === "in_progress" ? "Working" : "En Route"}
                  </Badge>
                </button>
              ))
            )}
          </div>
        </div>

        {selectedEmployee && (
          <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Details</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Name</p>
                <p className="font-semibold">{selectedEmployee.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge variant="outline">
                  {selectedEmployee.status === "in_progress" ? "Working" : "En Route"}
                </Badge>
              </div>
              {selectedEmployee.location && (
                <div>
                  <p className="text-muted-foreground">Location</p>
                  <p className="font-mono text-xs">
                    {selectedEmployee.location.lat.toFixed(4)}, {selectedEmployee.location.lng.toFixed(4)}
                  </p>
                </div>
              )}
              {selectedEmployee.assignment && (
                <div>
                  <p className="text-muted-foreground">Current Assignment</p>
                  <div className="mt-1 space-y-1">
                    <p className="font-semibold text-xs">{selectedEmployee.assignment.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedEmployee.assignment.address}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function calculateBounds(employees: Employee[]) {
  const locatedEmployees = employees.filter((e) => e.location);
  if (locatedEmployees.length === 0) {
    return { minLat: 33.5, maxLat: 33.8, minLng: -118.0, maxLng: -117.7 };
  }

  const lats = locatedEmployees.map((e) => e.location!.lat);
  const lngs = locatedEmployees.map((e) => e.location!.lng);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const padding = 0.01;
  return {
    minLat: minLat - padding,
    maxLat: maxLat + padding,
    minLng: minLng - padding,
    maxLng: maxLng + padding,
  };
}

function calculateScale(
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  width: number,
  height: number
) {
  const latRange = bounds.maxLat - bounds.minLat;
  const lngRange = bounds.maxLng - bounds.minLng;

  const scaleX = width / lngRange;
  const scaleY = height / latRange;

  return Math.min(scaleX, scaleY);
}

function projectCoordinates(
  lat: number,
  lng: number,
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  scale: number,
  canvas: HTMLCanvasElement
) {
  const relLat = lat - bounds.minLat;
  const relLng = lng - bounds.minLng;

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  const latRange = bounds.maxLat - bounds.minLat;
  const lngRange = bounds.maxLng - bounds.minLng;

  const x = centerX - ((lngRange / 2 - relLng) * scale);
  const y = centerY + ((latRange / 2 - relLat) * scale);

  return { x, y };
}
