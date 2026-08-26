import { AppstoreOutlined, BorderOutlined, FontSizeOutlined, ProfileOutlined } from '@ant-design/icons';
import { Badge, Button, Tooltip } from 'antd';
import React from 'react';

export interface EditorActivityItem {
	key: string;
	label: string;
	icon: string;
	badge?: number;
	disabled?: boolean;
}

interface EditorActivityRailProps {
	activeKey: string;
	items: EditorActivityItem[];
	footerItems?: EditorActivityItem[];
	onChange: (key: string) => void;
	label: string;
}

const ActivityButton = ({
	active,
	item,
	onChange,
}: {
	active: boolean;
	item: EditorActivityItem;
	onChange: (key: string) => void;
}) => {
	const icon = item.icon === 'info'
		? <ProfileOutlined />
		: item.icon === 'map'
			? <BorderOutlined />
			: item.icon === 'fontLayouts'
				? <FontSizeOutlined />
			: <AppstoreOutlined />;
	return (
		<Tooltip title={item.label} placement="right">
			<Button
				type={active ? 'primary' : 'text'}
				className="rde-activity-rail-button"
				disabled={item.disabled}
				aria-pressed={active}
				aria-label={item.label}
				onClick={() => onChange(item.key)}
			>
				<Badge count={item.badge} size="small" offset={[4, -2]}>
					<span className="rde-activity-rail-icon">{icon}</span>
				</Badge>
				<span className="rde-activity-rail-label">{item.label}</span>
			</Button>
		</Tooltip>
	);
};

export default function EditorActivityRail({
	activeKey,
	items,
	footerItems = [],
	onChange,
	label,
}: EditorActivityRailProps) {
	return (
		<nav className="rde-activity-rail" aria-label={label}>
			<div className="rde-activity-rail-primary">
				{items.map(item => (
					<ActivityButton
						key={item.key}
						item={item}
						active={activeKey === item.key}
						onChange={onChange}
					/>
				))}
			</div>
			{footerItems.length ? (
				<div className="rde-activity-rail-footer">
					{footerItems.map(item => (
						<ActivityButton
							key={item.key}
							item={item}
							active={activeKey === item.key}
							onChange={onChange}
						/>
					))}
				</div>
			) : null}
		</nav>
	);
}
