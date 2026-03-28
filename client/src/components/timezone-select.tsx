import { useState, useEffect } from "react";
import { 
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

// Hardcoded timezone options with GMT offset
const timezoneOptions = [
  { value: "Etc/GMT+12", label: "GMT-12:00" },
  { value: "Etc/GMT+11", label: "GMT-11:00" },
  { value: "Etc/GMT+10", label: "GMT-10:00" },
  { value: "Etc/GMT+9", label: "GMT-09:00" },
  { value: "Etc/GMT+8", label: "GMT-08:00" },
  { value: "Etc/GMT+7", label: "GMT-07:00" },
  { value: "Etc/GMT+6", label: "GMT-06:00" },
  { value: "Etc/GMT+5", label: "GMT-05:00" },
  { value: "Etc/GMT+4", label: "GMT-04:00" },
  { value: "Etc/GMT+3", label: "GMT-03:00" },
  { value: "Etc/GMT+2", label: "GMT-02:00" },
  { value: "Etc/GMT+1", label: "GMT-01:00" },
  { value: "Etc/GMT+0", label: "GMT+00:00" },
  { value: "Etc/GMT-1", label: "GMT+01:00" },
  { value: "Etc/GMT-2", label: "GMT+02:00" },
  { value: "Etc/GMT-3", label: "GMT+03:00" },
  { value: "Etc/GMT-4", label: "GMT+04:00" }, 
  { value: "Asia/Tbilisi", label: "GMT+04:00 (Tbilisi)" },
  { value: "Etc/GMT-5", label: "GMT+05:00" },
  { value: "Etc/GMT-6", label: "GMT+06:00" },
  { value: "Etc/GMT-7", label: "GMT+07:00" },
  { value: "Etc/GMT-8", label: "GMT+08:00" },
  { value: "Etc/GMT-9", label: "GMT+09:00" },
  { value: "Etc/GMT-10", label: "GMT+10:00" },
  { value: "Etc/GMT-11", label: "GMT+11:00" },
  { value: "Etc/GMT-12", label: "GMT+12:00" },
  { value: "Etc/GMT-13", label: "GMT+13:00" },
  { value: "Etc/GMT-14", label: "GMT+14:00" },
];

export function SelectTimezone({ value, onChange, className }: Props) {
  const [localTimezone, setLocalTimezone] = useState<string>(value || "Asia/Tbilisi");
  const [showUseMyTimezone, setShowUseMyTimezone] = useState(false);
  
  // Set user's local timezone if available and different from current value
  useEffect(() => {
    try {
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (userTimezone && userTimezone !== value) {
        setShowUseMyTimezone(true);
      }
    } catch (error) {
      console.error("Failed to detect user timezone:", error);
    }
  }, [value]);
  
  // Handle change in timezone selection
  const handleChange = (newValue: string) => {
    setLocalTimezone(newValue);
    onChange(newValue);
  };
  
  // Use browser's timezone
  const useMyTimezone = () => {
    try {
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (userTimezone) {
        // Try to find the closest GMT equivalent for consistency
        const date = new Date();
        const offset = date.getTimezoneOffset();
        // Convert minutes to hours (note: getTimezoneOffset() returns negative when timezone is ahead of UTC)
        const hours = Math.abs(Math.floor(offset / 60));
        // Format the GMT value
        const gmtValue = offset <= 0 ? `Etc/GMT-${hours}` : `Etc/GMT+${hours}`;
        
        // Find the closest match in our options
        const closestOption = timezoneOptions.find(tz => tz.value === gmtValue) || 
                             timezoneOptions.find(tz => tz.value === "Etc/GMT+0");
        
        if (closestOption) {
          handleChange(closestOption.value);
        } else {
          // Fallback to the actual timezone string if we can't find a match
          handleChange(userTimezone);
        }
        
        setShowUseMyTimezone(false);
      }
    } catch (error) {
      console.error("Failed to set user timezone:", error);
    }
  };
  
  return (
    <div className="space-y-2">
      <Select value={localTimezone} onValueChange={handleChange}>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Select timezone" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Timezones</SelectLabel>
            {timezoneOptions.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      
      {showUseMyTimezone && (
        <button 
          type="button"
          className="text-sm text-green-600 hover:text-green-800 mt-1"
          onClick={useMyTimezone}
        >
          Use my timezone
        </button>
      )}
    </div>
  );
}