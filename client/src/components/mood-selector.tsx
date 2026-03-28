import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@shared/schema";

const MOODS = [
  { emoji: "😊", name: "happy", description: "I understood this well" },
  { emoji: "😄", name: "excited", description: "This was really interesting!" },
  { emoji: "😐", name: "neutral", description: "It was okay" },
  { emoji: "😟", name: "confused", description: "I'm not sure I understand" },
  { emoji: "🤔", name: "thinking", description: "Makes me think deeply" }
];

interface MoodSelectorProps {
  progress?: Progress;
  onMoodSelect: (mood: string, note?: string) => void;
  contentTitle: string;
}

export function MoodSelector({ progress, onMoodSelect, contentTitle }: MoodSelectorProps) {
  const [selectedMood, setSelectedMood] = useState<string | null>(progress?.mood || null);
  const [note, setNote] = useState<string>(progress?.moodNote || "");
  const [isOpen, setIsOpen] = useState(false);

  const handleMoodSelect = (mood: string) => {
    setSelectedMood(mood);
  };

  const handleSubmit = () => {
    if (selectedMood) {
      onMoodSelect(selectedMood, note);
      setIsOpen(false);
    }
  };

  const displayEmoji = selectedMood || "😶";

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className="flex items-center gap-1 text-xs px-2"
          size="sm"
          aria-label="Select how you feel about this content"
        >
          <span className="text-base">{displayEmoji}</span>
          <span className="hidden sm:inline">Feedback</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <h4 className="font-medium text-center">
            How did you feel about "{contentTitle}"?
          </h4>
          
          <div className="grid grid-cols-5 gap-2">
            {MOODS.map((mood) => (
              <Button
                key={mood.name}
                variant={selectedMood === mood.emoji ? "default" : "outline"}
                className="flex flex-col items-center p-2 h-auto"
                onClick={() => handleMoodSelect(mood.emoji)}
              >
                <span className="text-2xl mb-1">{mood.emoji}</span>
                <span className="text-xs">{mood.description}</span>
              </Button>
            ))}
          </div>
          
          <div className="space-y-2">
            <label className="text-sm text-gray-500">
              Add a note (optional)
            </label>
            <Textarea
              placeholder="Share your thoughts..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-20"
            />
          </div>
          
          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={!selectedMood}
            >
              Save Feedback
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}