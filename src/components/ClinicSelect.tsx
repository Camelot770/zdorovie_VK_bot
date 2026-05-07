import { Building2 } from "lucide-react";
import CustomSelect from "./ui/CustomSelect";
import type { Clinic } from "../types";

interface ClinicSelectProps {
  clinics: Clinic[];
  value: string;
  onChange: (id: string, name: string) => void;
  loading?: boolean;
}

export default function ClinicSelect({
  clinics,
  value,
  onChange,
  loading,
}: ClinicSelectProps) {
  const options = [
    { value: "", label: "Все филиалы" },
    ...clinics.map((c) => ({
      value: c.id,
      label: c.shortAddress || c.name,
    })),
  ];

  return (
    <CustomSelect
      label="Филиал"
      placeholder="Все филиалы"
      options={options}
      value={value}
      onChange={onChange}
      loading={loading}
      icon={<Building2 className="w-4 h-4" />}
    />
  );
}
