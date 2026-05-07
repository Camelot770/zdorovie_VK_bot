import { Stethoscope } from "lucide-react";
import CustomSelect from "./ui/CustomSelect";
import type { Specialization } from "../types";

interface SpecializationSelectProps {
  specializations: Specialization[];
  value: string;
  onChange: (id: string, name: string) => void;
  loading?: boolean;
}

export default function SpecializationSelect({
  specializations,
  value,
  onChange,
  loading,
}: SpecializationSelectProps) {
  const options = [
    { value: "", label: "Все специальности" },
    ...specializations.map((s) => ({
      value: s.id,
      label: s.name,
    })),
  ];

  return (
    <CustomSelect
      label="Специальность"
      placeholder="Все специальности"
      options={options}
      value={value}
      onChange={onChange}
      loading={loading}
      icon={<Stethoscope className="w-4 h-4" />}
    />
  );
}
