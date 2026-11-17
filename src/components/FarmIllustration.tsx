import characterGreen from "@/assets/character-green.png";
import characterYellow from "@/assets/character-yellow.png";

/** Original 말해농 characters, shared by the hero and inner-page headers. */
export function FarmIllustration() {
  return (
    <div className="farm-illustration" aria-hidden="true">
      <img
        src={characterGreen}
        alt=""
        width={507}
        height={667}
        className="farm-character"
        decoding="async"
      />
      <img
        src={characterYellow}
        alt=""
        width={397}
        height={510}
        className="farm-character"
        decoding="async"
      />
    </div>
  );
}
