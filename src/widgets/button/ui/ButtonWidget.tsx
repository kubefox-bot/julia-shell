import type { WidgetRenderProps } from '../../../entities/widget/model/types';
import { Button } from '../../../shared/ui/Button';
import styles from './ButtonWidget.module.scss';

export function ButtonWidget(_props: WidgetRenderProps) {
  return (
    <div className={styles.root}>
      <Button type="button" className={styles.button}>
        Press
      </Button>
    </div>
  );
}
