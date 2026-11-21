import { Scroll } from "@/features/journey/components/ui";
import { cn } from "@/lib/utils";
import { FloatingNumbers, useDeltaFloats } from "./float-number";
import type { ArenaTeam } from "../schemas/arena";

/** Faixa horizontal dos números de pontos na linha do placar (constante estável). */
const POINTS_SPREAD: readonly [number, number] = [60, 88];

/** Linha do placar: flutua `−X`/`+X` quando os pontos mudam (ADR-022). */
function PlacarRow({ team }: { team: ArenaTeam }) {
  const pointsFloats = useDeltaFloats(team.points, POINTS_SPREAD);

  return (
    <li className="relative flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-display text-xs font-semibold",
            team.position === 1
              ? "border-accent/50 bg-accent/20 text-accent-foreground"
              : "border-border text-muted-foreground",
          )}
        >
          {team.position}
        </span>
        <span className="truncate text-sm font-medium">{team.group_name}</span>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-display text-sm font-semibold">{team.points} pts</p>
        <p className="text-[0.7rem] text-muted-foreground">
          {team.total_damage} de dano
          {team.retaliation_loss > 0 && (
            <span className="text-destructive"> · −{team.retaliation_loss}</span>
          )}
          {team.criteria && <span className="text-success"> · notas ✓</span>}
          {team.damage_factor < 1 && (
            <span className="text-destructive">
              {" "}· ataque −{Math.round((1 - team.damage_factor) * 100)}%
            </span>
          )}
          {team.shield > 0 && (
            <span className="text-info"> · escudo {team.shield}</span>
          )}
          {team.damage_buff > 0 && (
            <span className="text-success">
              {" "}· próximo ataque +{Math.round(team.damage_buff * 100)}%
            </span>
          )}
        </p>
      </div>
      {/* variação de pontos subindo na tela (ADR-022) */}
      <FloatingNumbers items={pointsFloats} className="bottom-5 text-base" />
    </li>
  );
}

/** Placar ao vivo das equipes (ordenado por pontos, `position` vem do back-end). */
export function PlacarCard({ teams }: { teams: ArenaTeam[] }) {
  return (
    <Scroll className="flex h-full flex-col gap-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg">Placar das Equipes</h2>
        <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Dano · Pontos</span>
      </div>

      {teams.length === 0 ? (
        <p className="font-reading text-sm text-muted-foreground">
          Nenhuma equipe participando ainda. Inicie a batalha para registrá-las.
        </p>
      ) : (
        <ul className="space-y-2">
          {teams.map((team) => (
            <PlacarRow key={team.group_id} team={team} />
          ))}
        </ul>
      )}
    </Scroll>
  );
}
