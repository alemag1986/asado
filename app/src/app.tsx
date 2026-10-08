import { Nav } from '@/components/Nav';
import { state, setScreen } from '@/lib/store';
import { Cook } from '@/screens/Cook';
import { Fire } from '@/screens/Fire';
import { Landing } from '@/screens/Landing';
import { Meat } from '@/screens/Meat';

const STEPS = [
  { id: 'meat', step: '01', label: 'Meat' },
  { id: 'fire', step: '02', label: 'Fire' },
  { id: 'cook', step: '03', label: 'Cook' },
];

export function App() {
  const screen = state.value.screen;
  const inWizard = screen === 'meat' || screen === 'fire' || screen === 'cook';

  return (
    <div class="page">
      <main class="page__body">
        {screen === 'landing' ? <Landing /> : null}
        {screen === 'meat' ? <Meat /> : null}
        {screen === 'fire' ? <Fire /> : null}
        {screen === 'cook' ? <Cook /> : null}
      </main>
      {inWizard ? <Nav items={STEPS} activeId={screen} onSelect={(id) => setScreen(id as typeof screen)} /> : null}
    </div>
  );
}